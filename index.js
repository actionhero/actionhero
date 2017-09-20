const path = require('path');

[
  'Process',
  'Action',
  'Task',
  'Initializer',
  'Server',
  'CLI',
  'ActionProcessor',
  'Connection'
].forEach((component) => {
  let fileName = component.charAt(0).toLowerCase() + component.substring(1)
  exports[component] = require(path.join(__dirname, 'classes', `${fileName}.js`))
})
