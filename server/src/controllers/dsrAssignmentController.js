const DsrAssignment = require("../models/DsrAssignment");
const DsrSchedule = require("../models/DsrSchedule");
const PurchaseInvoice = require("../models/PurchaseInvoice");
const User = require("../models/User");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const ExcelJS = require("exceljs");
const telegramService = require("../services/telegramService");
const { getSriLankaTime, getStartOfDaySriLanka, getEndOfDaySriLanka } = require('../utils/dateUtils');


/**
 * Generate assignment number
 */
const generateAssignmentNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ASG-${year}${month}${day}-${random}`;
};

/**
 * Assign phones to DSR
 * @route POST /api/v1/dsr-assignments
 * @access Private (Admin/Clerk only)
 */
const createAssignment = async (req, res, next) => {
  try {
    const { dsrId, phones, notes } = req.body;

    // Validate DSR exists and has DSR role
    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== "dsr") {
      return next(new ApiError(400, "Invalid DSR. User must have DSR role."));
    }

    // Check if DSR has a schedule for today
    const todaySriLanka = getStartOfDaySriLanka(getSriLankaTime());
    
    let schedule = await DsrSchedule.findOne({
      dsr: dsrId,
      date: {
        $gte: todaySriLanka,
        $lt: getEndOfDaySriLanka(todaySriLanka)
      }
    });

    // If no schedule exists for today, create one automatically
    if (!schedule) {
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todaySriLanka.getDay()];
      
      schedule = await DsrSchedule.create({
        dsr: dsrId,
        date: todaySriLanka,
        dayOfWeek: dayOfWeek,
        week: getWeekNumber(todaySriLanka),
        month: todaySriLanka.getMonth() + 1,
        year: todaySriLanka.getFullYear(),
        scheduleType: 'WorkDay',
        shifts: [
          {
            startTime: '08:00',
            endTime: '17:00',
            shiftName: 'Default Shift'
          }
        ],
        createdBy: req.user._id,
      });

      logger.info(`Auto-created schedule for DSR ${dsr.email} on ${todaySriLanka.toISOString()}`);
    }

    // Check if schedule already has an assignment
    if (schedule.assignment) {
      return next(new ApiError(400, `DSR ${dsr.fullName} already has an assignment for today. Please return existing phones first.`));
    }

    // Validate all phones are available
    const phoneDetails = [];
    for (const phoneData of phones) {
      const { imei, targetPrice } = phoneData;

      // Find phone in inventory
      const invoice = await PurchaseInvoice.findOne({
        "phones.imei": imei,
      });

      if (!invoice) {
        return next(new ApiError(404, `Phone with IMEI ${imei} not found in inventory`));
      }

      const phone = invoice.phones.find((p) => p.imei === imei);

      if (!phone) {
        return next(new ApiError(404, `Phone with IMEI ${imei} not found`));
      }

      // Check if phone is available (not already assigned)
      if (phone.status !== "Available") {
        return next(
          new ApiError(
            400,
            `Phone with IMEI ${imei} is not available. Current status: ${phone.status}`
          )
        );
      }

      // Update phone status to 'Assigned'
      phone.status = "Assigned";
      await invoice.save();

      phoneDetails.push({
        invoice: invoice._id,
        product: phone.product,
        imei: phone.imei,
        assignedPrice: phone.costPrice,
        targetPrice: targetPrice || phone.sellingPrice,
        status: "Assigned",
      });
    }

    // Create assignment
    const now = getSriLankaTime();
    const assignment = await DsrAssignment.create({
      assignmentNumber: generateAssignmentNumber(),
      assignmentDate: now,
      assignmentTime: `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      dsr: dsrId,
      schedule: schedule._id, // Link to schedule
      phones: phoneDetails,
      notes,
      assignedBy: req.user._id,
    });

    // Update schedule with assignment reference
    schedule.assignment = assignment._id;
    schedule.performance.phonesAssigned = phoneDetails.length;
    await schedule.save();

    // Populate DSR details
    await assignment.populate("dsr", "firstName lastName email phone");
    await assignment.populate("phones.product");
    await assignment.populate("schedule");

    logger.info(
      `Assignment ${assignment.assignmentNumber} created and linked to schedule ${schedule._id} for DSR ${dsr.email}`
    );

    // Send Telegram notification if assigned by Clerk
    if (req.user.role === "clerk") {
      try {
        await telegramService.sendAssignmentNotification(assignment);
      } catch (error) {
        logger.error(`Failed to send Telegram notification: ${error.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: "Phones assigned to DSR successfully and linked to today's schedule",
      data: {
        assignment: assignment.getSummary(),
        schedule: schedule.getSummary(),
        details: assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Get week number
 */
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/**
 * Get all assignments
 * @route GET /api/v1/dsr-assignments
 * @access Private (All authenticated users)
 */
const getAllAssignments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      dsrId,
      status,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (dsrId) filter.dsr = dsrId;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.assignmentDate = {};
      if (startDate) filter.assignmentDate.$gte = new Date(startDate);
      if (endDate) filter.assignmentDate.$lte = new Date(endDate);
    }

    // DSRs can only see their own assignments
    if (req.user.role === "dsr") {
      filter.dsr = req.user._id;
    }

    const skip = (page - 1) * limit;

    const assignments = await DsrAssignment.find(filter)
      .populate("dsr", "firstName lastName email phone")
      .populate("phones.product")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ assignmentDate: -1 });

    const total = await DsrAssignment.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        assignments: assignments.map((a) => a.getSummary()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalAssignments: total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get assignment by ID
 * @route GET /api/v1/dsr-assignments/:id
 * @access Private
 */
const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await DsrAssignment.findById(req.params.id)
      .populate("dsr", "firstName lastName email phone")
      .populate("phones.product")
      .populate("assignedBy", "firstName lastName email")
      .populate("returnedBy", "firstName lastName email");

    if (!assignment) {
      return next(new ApiError(404, "Assignment not found"));
    }

    // DSRs can only view their own assignments
    if (
      req.user.role === "dsr" &&
      assignment.dsr._id.toString() !== req.user._id.toString()
    ) {
      return next(new ApiError(403, "Access denied"));
    }

    res.status(200).json({
      success: true,
      data: { assignment },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark phone as sold
 * @route PATCH /api/v1/dsr-assignments/:id/phones/:imei/sold
 */
const markPhoneAsSold = async (req, res, next) => {
  try {
    const { id, imei } = req.params;
    const { soldPrice, soldDate } = req.body;

    const assignment = await DsrAssignment.findById(id).populate('schedule');

    if (!assignment) {
      return next(new ApiError(404, "Assignment not found"));
    }

    // DSR can only update their own assignments
    if (
      req.user.role === "dsr" &&
      assignment.dsr.toString() !== req.user._id.toString()
    ) {
      return next(new ApiError(403, "You can only update your own assignments"));
    }

    const phone = assignment.phones.find((p) => p.imei === imei);

    if (!phone) {
      return next(new ApiError(404, `Phone with IMEI ${imei} not found in this assignment`));
    }

    if (phone.status !== "Assigned") {
      return next(
        new ApiError(400, `Phone is already ${phone.status.toLowerCase()}. Cannot mark as sold.`)
      );
    }

    // Update phone in assignment
    phone.status = "Sold";
    phone.soldDate = soldDate || getSriLankaTime();
    phone.soldPrice = soldPrice;

    // Update phone in inventory
    const invoice = await PurchaseInvoice.findOne({ "phones.imei": imei });
    const inventoryPhone = invoice.phones.find((p) => p.imei === imei);
    inventoryPhone.status = "Sold";
    inventoryPhone.soldDate = phone.soldDate;

    await invoice.save();
    await assignment.save();

    // Update schedule performance metrics
    if (assignment.schedule) {
      const schedule = await DsrSchedule.findById(assignment.schedule);
      if (schedule) {
        schedule.performance.phonesSold += 1;
        schedule.performance.revenue += soldPrice;
        schedule.performance.profit += (soldPrice - phone.assignedPrice);
        await schedule.save();
      }
    }

    logger.info(
      `Phone ${imei} marked as sold in assignment ${assignment.assignmentNumber} for Rs. ${soldPrice}`
    );

    res.status(200).json({
      success: true,
      message: "Phone marked as sold successfully",
      data: {
        phone: {
          imei: phone.imei,
          status: phone.status,
          soldPrice: phone.soldPrice,
          soldDate: phone.soldDate,
          profit: soldPrice - phone.assignedPrice,
        },
        assignment: assignment.getSummary(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Return phones (unsold)
 * @route PATCH /api/v1/dsr-assignments/:id/return
 */
const returnPhones = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imeis, returnNotes } = req.body;

    const assignment = await DsrAssignment.findById(id).populate('schedule');

    if (!assignment) {
      return next(new ApiError(404, "Assignment not found"));
    }

    // DSR can only return their own assignments
    if (
      req.user.role === "dsr" &&
      assignment.dsr.toString() !== req.user._id.toString()
    ) {
      return next(new ApiError(403, "You can only return your own assignments"));
    }

    if (!assignment.canReturn()) {
      return next(new ApiError(400, "No phones available to return in this assignment"));
    }

    const returnedPhones = [];
    const now = getSriLankaTime();

    // Process each IMEI
    for (const imei of imeis) {
      const phone = assignment.phones.find((p) => p.imei === imei);

      if (!phone) {
        logger.warn(`IMEI ${imei} not found in assignment ${assignment.assignmentNumber}`);
        continue;
      }

      if (phone.status === "Sold") {
        logger.warn(`Cannot return sold phone: ${imei}`);
        continue;
      }

      if (phone.status === "Returned") {
        logger.warn(`Phone ${imei} already returned`);
        continue;
      }

      // Update phone status
      phone.status = "Returned";
      phone.returnedDate = now;
      phone.returnNotes = returnNotes;

      // Update inventory
      const invoice = await PurchaseInvoice.findOne({ "phones.imei": imei });
      const inventoryPhone = invoice.phones.find((p) => p.imei === imei);
      inventoryPhone.status = "Available";
      await invoice.save();

      returnedPhones.push(phone);
    }

    // Update assignment status
    assignment.returnDate = now;
    assignment.returnTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    assignment.returnedBy = req.user._id;
    assignment.returnNotes = returnNotes;

    await assignment.save();

    // Update schedule performance metrics
    if (assignment.schedule) {
      const schedule = await DsrSchedule.findById(assignment.schedule);
      if (schedule) {
        schedule.performance.phonesReturned += returnedPhones.length;
        await schedule.save();
      }
    }

    logger.info(
      `${returnedPhones.length} phones returned from assignment ${assignment.assignmentNumber}`
    );

    res.status(200).json({
      success: true,
      message: `${returnedPhones.length} phone(s) returned successfully`,
      data: {
        returnedPhones: returnedPhones.map((p) => ({
          imei: p.imei,
          returnedDate: p.returnedDate,
        })),
        assignment: assignment.getSummary(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export daily assignment report to Excel
 * @route GET /api/v1/dsr-assignments/reports/daily
 * @access Private (Admin/Clerk)
 */
const exportDailyReport = async (req, res, next) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const assignments = await DsrAssignment.find({
      assignmentDate: {
        $gte: targetDate,
        $lt: nextDay,
      },
    })
      .populate("dsr", "firstName lastName email phone")
      .populate("phones.product");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daily DSR Assignments");

    // Header
    worksheet.columns = [
      { header: "Assignment #", key: "assignmentNumber", width: 20 },
      { header: "DSR Name", key: "dsrName", width: 25 },
      { header: "DSR Phone", key: "dsrPhone", width: 15 },
      { header: "Total Phones", key: "totalPhones", width: 12 },
      { header: "Assigned", key: "assigned", width: 12 },
      { header: "Sold", key: "sold", width: 12 },
      { header: "Returned", key: "returned", width: 12 },
      { header: "Total Value", key: "totalValue", width: 15 },
      { header: "Sold Revenue", key: "soldRevenue", width: 15 },
      { header: "Profit", key: "profit", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    // Add data
    assignments.forEach((assignment) => {
      worksheet.addRow({
        assignmentNumber: assignment.assignmentNumber,
        dsrName: `${assignment.dsr.firstName} ${assignment.dsr.lastName}`,
        dsrPhone: assignment.dsr.phone,
        totalPhones: assignment.totalPhones,
        assigned: assignment.assignedPhonesCount,
        sold: assignment.soldPhones,
        returned: assignment.returnedPhones,
        totalValue: assignment.totalValue,
        soldRevenue: assignment.soldRevenue,
        profit: assignment.profitGenerated,
        status: assignment.status,
      });
    });

    // Format currency
    ["totalValue", "soldRevenue", "profit"].forEach((col) => {
      worksheet.getColumn(col).numFmt = '"Rs. "#,##0.00';
    });

    const filename = `daily_dsr_report_${
      targetDate.toISOString().split("T")[0]
    }.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    logger.info(`Daily DSR report exported by ${req.user.email}`);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  markPhoneAsSold,
  returnPhones,
  exportDailyReport,
};
