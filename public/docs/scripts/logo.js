(function () {
  var container = document.createElement('div')
  container.id = 'nav-logo-container'
  container.innerHTML = '<a href="/"><img style="width:50%; padding-top: 10px" id="nav-logo" src="https://raw.github.com/actionhero/actionhero/master/public/logo/actionhero-small.png" /></a>'

  var navHeader = document.querySelectorAll('nav h2')[0];
  navHeader.parentNode.insertBefore(container, navHeader)
})()
