(function () {
  var styleSheet = document.createElement('style');
  styleSheet.type ='text/css';

  style = ''
  style += 'hr { color:#E14E3A; background-color:#E14E3A; border:0; height:2px; }'
  style += 'nav { background: #FFFFFF; border-right: thick double #6E8898; }'
  style += 'nav > ul > li > a { color: #606; color: #E14E3A; }'
  style += 'a { color: #E14E3A }'
  style += 'a:active { color: #E14E3A }'
  style += 'h1, h2, h3, h4, h5, h6 { color: #2F5266; font-weight: 600 }'
  style += 'h2 { font-weight: 600; padding-top: 30px; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 2px solid #E14E3A; }'
  style += 'nav > h2 { border-bottom: 0px }'
  style += 'nav > h2 > a { font-weight: bold; color: #E14E3A !important; }'
  style += 'h4.name { background: #2F5266 }'
  style += 'footer { margin-top: 20px; font-size: 75% }'

  if(styleSheet.styleSheet){
      styleSheet.styleSheet.cssText = style;
  } else {
      styleSheet.appendChild(document.createTextNode(style));
  }

  document.getElementsByTagName('head')[0].appendChild(styleSheet);
})()
