from pathlib import Path
import base64,json
root=Path(__file__).resolve().parents[1]
files={'library':'tesseract.min.js','worker':'worker.min.js','core':'core/tesseract-core-lstm.wasm.js','eng':'lang/eng.traineddata.gz','por':'lang/por.traineddata.gz'}
assets={k:base64.b64encode((root/'vendor/ocr'/f).read_bytes()).decode() for k,f in files.items()}
source=(root/'YourFXjourney.html').read_text()
for name in ['plan-engine','session-engine','daily-workspace','assistant','terminal']:
 source=source.replace(f'<script src="public/{name}.js"></script>', '<script>'+ (root/'public'/f'{name}.js').read_text().replace('</script', '<\\/script') +'</script>')
source=source.replace('<link rel="stylesheet" href="public/assistant.css">', '<style>'+(root/'public/assistant.css').read_text()+'</style>')
source=source.replace('<link rel="stylesheet" href="public/terminal.css">', '<style>'+(root/'public/terminal.css').read_text()+'</style>')
source=source.replace('src="public/elitex-mark.png"','src="data:image/png;base64,'+base64.b64encode((root/'public/elitex-mark.png').read_bytes()).decode()+'"')
source=source.replace('<script>','<script id="ocr-embedded-assets" type="application/json">'+json.dumps(assets,separators=(',',':'))+'</script>\n<script>',1)
out=root/'YourFXjourney-standalone.html';out.write_text(source)
print('Standalone:',out,round(out.stat().st_size/1024/1024,1),'MB')
