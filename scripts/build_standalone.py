from pathlib import Path
import base64,json
root=Path(__file__).resolve().parents[1]
files={'library':'tesseract.min.js','worker':'worker.min.js','core':'core/tesseract-core-lstm.wasm.js','eng':'lang/eng.traineddata.gz','por':'lang/por.traineddata.gz'}
assets={k:base64.b64encode((root/'vendor/ocr'/f).read_bytes()).decode() for k,f in files.items()}
source=(root/'YourFXjourney.html').read_text()
source=source.replace('<script>','<script id="ocr-embedded-assets" type="application/json">'+json.dumps(assets,separators=(',',':'))+'</script>\n<script>',1)
out=root/'YourFXjourney-standalone.html';out.write_text(source)
print('Standalone:',out,round(out.stat().st_size/1024/1024,1),'MB')
