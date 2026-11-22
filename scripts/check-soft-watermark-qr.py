"""Local actual QR decoding; requires free Pillow + zxing-cpp. No network/profile lookup."""
import json,sys
from pathlib import Path
from PIL import Image
import zxingcpp
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]) if len(sys.argv)>1 else root/'docs/watermark-soft-comparison'
expected=set()
for number in ['15289007429','18673575510']:
 codes={c.text for c in zxingcpp.read_barcodes(Image.open(root/'public/branding'/f'wechat-{number}.jpg')) if c.valid and c.format==zxingcpp.BarcodeFormat.QRCode}
 assert len(codes)==1,number+' original decode failed'
 expected.update(codes)
for mode in ['before','after']:
 actual={c.text for c in zxingcpp.read_barcodes(Image.open(out/f'list-{mode}.png')) if c.valid and c.format==zxingcpp.BarcodeFormat.QRCode}
 assert actual==expected,mode+' exported QR missing or changed'
checks=json.loads((out/'list-checks.json').read_text())
assert checks['rotations']==0 and checks['translucentText']==0 and checks['translucentImages']==0
assert checks['quiet']['minimumTestedClearWidth']>=11 and checks['quiet']['whiteBorderPixels']>10000
(out/'qr-checks.json').write_text(json.dumps({'originals':2,'beforeDecoded':2,'afterDecoded':2,'expectedPayloadsUnchanged':True,'quietZoneChecks':checks['quiet']},indent=2))
print('PASS both original WeChat codes and before/after real exported lists decode to identical expected payloads; clear white quiet borders preserved; zero diagonal/transparent document overlays.')
