from pathlib import Path
import base64,json,re
root=Path(__file__).resolve().parents[1]
files={'library':'tesseract.min.js','worker':'worker.min.js','core':'core/tesseract-core-lstm.wasm.js','eng':'lang/eng.traineddata.gz','por':'lang/por.traineddata.gz'}
assets={k:base64.b64encode((root/'vendor/ocr'/f).read_bytes()).decode() for k,f in files.items()}
source=(root/'YourFXjourney.html').read_text()
for name in ['plan-engine','session-engine','daily-workspace','assistant','asset-picker','account-tools','terminal','premium','diary','mt5-import','office','trader-review','reference','dashboard','mobile','cloud','smc','management']:
 source=source.replace(f'<script src="public/{name}.js"></script>', '<script>'+ (root/'public'/f'{name}.js').read_text().replace('</script', '<\\/script') +'</script>')
source=source.replace('<link rel="stylesheet" href="public/assistant.css">', '<style>'+(root/'public/assistant.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/terminal.css">', '<style>'+(root/'public/terminal.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/reference.css">', '<style>'+(root/'public/reference.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/mobile.css">', '<style>'+(root/'public/mobile.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/cloud.css">', '<style>'+(root/'public/cloud.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/smc.css">', '<style>'+(root/'public/smc.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/premium.css">', '<style>'+(root/'public/premium.css').read_text()+'</style>')
source=source.replace('src="public/elitex-mark.png"','src="data:image/png;base64,'+base64.b64encode((root/'public/elitex-mark.png').read_bytes()).decode()+'"')
source=source.replace('<script>','<script id="ocr-embedded-assets" type="application/json">'+json.dumps(assets,separators=(',',':'))+'</script>\n<script>',1)
# The SMC theme supersedes the retired scenes in all views.
for retired in ['elitex-office-scene.png','elitex-workstation.png']:
 source=re.sub(r'url\([\'"]'+re.escape(retired)+r'[\'"]\)', 'none', source)
font_data=base64.b64encode((root/'public/fonts/inter-latin-wght-normal.woff2').read_bytes()).decode()
source=source.replace('url("fonts/inter-latin-wght-normal.woff2")','url("data:font/woff2;base64,'+font_data+'")')
source=source.replace('src="public/smc-logo.png"','src="data:image/png;base64,'+base64.b64encode((root/'public/smc-logo.png').read_bytes()).decode()+'"')
# Embed image URLs directly: Chromium limits the size of CSS custom-property values.
for filename in ['smc-workstation.png']:
 data_url="url('data:image/png;base64,"+base64.b64encode((root/'public'/filename).read_bytes()).decode()+"')"
 source=re.sub(r'url\([\'"]'+re.escape(filename)+r'[\'"]\)', lambda match: data_url, source)
out=root/'YourFXjourney-standalone.html';out.write_text(source)
print('Standalone:',out,round(out.stat().st_size/1024/1024,1),'MB')
