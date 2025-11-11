/**
 * Route Listing Utility
 * Displays all registered Express routes on server startup
 */

/**
 * Get all registered routes from Express app
 * @param {Express} app - Express application instance
 * @returns {Array} Array of route objects
 */
const getRegisteredRoutes = (app) => {
  const routes = [];

  // Helper function to extract routes from middleware stack
  const extractRoutes = (stack, basePath = '') => {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Regular route
        const methods = Object.keys(middleware.route.methods)
          .filter(method => middleware.route.methods[method])
          .map(method => method.toUpperCase());
        
        routes.push({
          path: basePath + middleware.route.path,
          methods: methods,
          middlewares: middleware.route.stack.map(s => s.name || 'anonymous'),
        });
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        // Nested router
        const routerPath = middleware.regexp
          .toString()
          .replace('/^', '')
          .replace('\\/?(?=\\/|$)/i', '')
          .replace(/\\\//g, '/')
          .replace(/\\/g, '')
          .replace('/?(?=/|$)', '')
          .replace(/\^/g, '')
          .replace(/\$/g, '');
        
        extractRoutes(middleware.handle.stack, routerPath);
      }
    });
  };

  extractRoutes(app._router.stack);
  return routes;
};

/**
 * Get route count summary
 * @param {Array} routes - Array of route objects
 * @returns {Object} Route count by method
 */
const getRouteSummary = (routes) => {
  const summary = {
    GET: 0,
    POST: 0,
    PUT: 0,
    PATCH: 0,
    DELETE: 0,
    total: routes.length,
  };

  routes.forEach(route => {
    route.methods.forEach(method => {
      if (summary[method] !== undefined) {
        summary[method]++;
      }
    });
  });

  return summary;
};

/**
 * Display routes in a formatted table
 * @param {Array} routes - Array of route objects
 * @returns {string} Formatted route table
 */
const displayRoutesTable = (routes) => {
  if (routes.length === 0) {
    return 'No routes registered';
  }

  // Group routes by category
  const categorized = {
    'Health & System': [],
    'Authentication': [],
    'User Management': [],
    'Inventory & Products': [],
    'Purchase Invoices': [],
    'DSR Assignments': [],
    'DSR Schedule Management': [],
    'Import/Export': [],
    'Testing': [],
    'Other': [],
  };

  routes.forEach(route => {
    if (route.path === '/' || route.path === '/health') {
      categorized['Health & System'].push(route);
    } else if (route.path.includes('/auth')) {
      categorized['Authentication'].push(route);
    } else if (route.path.includes('/users')) {
      categorized['User Management'].push(route);
    } else if (route.path.includes('/dsr-schedules')) {
      categorized['DSR Schedule Management'].push(route);
    } else if (route.path.includes('/dsr-assignments')) {
      categorized['DSR Assignments'].push(route);
    } else if (route.path.includes('/import') || route.path.includes('/export')) {
      categorized['Import/Export'].push(route);
    } else if (route.path.includes('/inventory/products') || route.path.includes('/inventory/stock') || route.path.includes('/inventory/search') || route.path.includes('/inventory/statistics')) {
      categorized['Inventory & Products'].push(route);
    } else if (route.path.includes('/inventory/invoices') || route.path.includes('/inventory/phones')) {
      categorized['Purchase Invoices'].push(route);
    } else if (route.path.includes('/test')) {
      categorized['Testing'].push(route);
    } else {
      categorized['Other'].push(route);
    }
  });

  let output = '\n';
  output += '📡 REGISTERED API ROUTES\n';

  Object.entries(categorized).forEach(([category, categoryRoutes]) => {
    if (categoryRoutes.length > 0) {
      output += `\n`;
      output += `  ${category.padEnd(75)}  \n`;
      output += `  ${'-'.repeat(75)}  \n`;

      categoryRoutes.forEach(route => {
        const methods = route.methods.join(', ').padEnd(20);
        const path = route.path.padEnd(50);
        output += `  ${methods} ${path}  \n`;
      });
    }
  });

  output += '\n';
  output += '\n';

  return output;
};

module.exports = {
  getRegisteredRoutes,
  getRouteSummary,
  displayRoutesTable,
};