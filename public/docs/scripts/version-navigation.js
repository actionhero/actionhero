var DOCUMENTATION_VERSIONS = DOCUMENTATION_VERSIONS || [];

(function () {
  if (DOCUMENTATION_VERSIONS.length < 2) { return }

  var container = document.createElement('div')
  container.innerHTML = '<br />'
  var form = document.createElement('form');

  var label = document.createElement('label');
  label.htmlFor = 'versions';
  label.style = 'font-size: 12px'
  label.innerHTML = 'Version:';
  form.appendChild(label)

  var select = document.createElement('select')
  select.id = "versions"
  select.style = "border: 1px inset; padding: 2px; margin: 2px;"
  // select.style.width = '80%'
  select.onchange = function () { window.location.href = select[select.selectedIndex].value }
  form.appendChild(select)

  window.DOCUMENTATION_VERSIONS.forEach((version) => {
    var option = document.createElement('option')
    var value = '/'
    if (version !== 'master') { value = '/' + version }
    option.setAttribute('value', value)

    var pathParts = window.location.pathname.split('/')
    if (pathParts[1] === version) {
      option.setAttribute('selected', false)
    }

    option.innerHTML = version
    select.appendChild(option)
  })

  container.appendChild(form)

  var navHeader = document.querySelectorAll('nav h2')[2];
  navHeader.parentNode.insertBefore(container, navHeader.nextSibling)
})()
