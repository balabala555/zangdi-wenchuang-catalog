"""Optional local-only QR regression. Requires Pillow and zxing-cpp, no service or paid API.
Run after check-customer-qr.mjs: python scripts/check-qr-scan.py /tmp/catalog-qr-check
"""
import sys
from pathlib import Path
from PIL import Image
import zxingcpp
expected={
 '15289007429':'https://u.wechat.com/MAYzXptirgIYEhjbaTnt7Tc?s=2',
 '18673575510':'https://u.wechat.com/EOEyST6blR0zZHTkVsgeP6Q?s=2',
}
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/catalog-qr-check')
def decoded(path):
 results=zxingcpp.read_barcodes(Image.open(path))
 return {result.text for result in results if result.valid and result.format==zxingcpp.BarcodeFormat.QRCode}
for number,payload in expected.items():
 assert decoded(root/'public/branding'/('wechat-'+number+'.jpg'))=={payload},number+' original failed'
 for mode in ['web','offline']:
  assert decoded(output/(mode+'-'+number+'.png'))=={payload},mode+' displayed QR failed: '+number
for mode in ['web','offline']:
 assert decoded(output/(mode+'-cart.png'))==set(expected.values()),mode+' exported PNG missing/wrong QR'
print('PASS: both originals, four browser-rendered QR images and both exported PNG lists decode to the same expected WeChat links; no online profile lookup performed.')

# Full-size branded product files must preserve both actual contact codes too.
for photo in (root/'public/images/felt-mushroom-bag').glob('*.jpg'):
 assert decoded(photo)==set(expected.values()),'Product signature QR missing/wrong: '+photo.name
print('PASS: both actual QR codes decode from all three full-size branded product photos.')
