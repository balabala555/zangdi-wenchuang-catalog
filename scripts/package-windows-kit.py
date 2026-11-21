"""Developer-only packaging; Windows users need Node + Git, not Python."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json
root = Path(__file__).resolve().parent.parent
files = {'一键迁移.cmd': '06-migrate.cmd', **{f'scripts/{n}': f'scripts/{n}' for n in ['local-preview.mjs', 'preview-backup.mjs', 'preview-control.mjs']}}
output = root / 'tools/windows-migration-v1.3.3.zip'
manifest = {}
with ZipFile(output, 'w', ZIP_DEFLATED) as z:
    for name, source in files.items():
        data = (root / source).read_bytes()
        z.writestr(name, data)
        manifest[name] = hashlib.sha256(data).hexdigest()
    z.writestr('文件校验.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    z.writestr('请先阅读.txt', '这是一次性迁移包，不是完整网站。解压后双击“一键迁移.cmd”，选择原网站文件夹（含02-start.cmd及package.json）。原目录和资料会被保留、备份，标准Git测试目录另行创建。需要已安装免费的Node.js和Git for Windows。以后只在自动打开的新固定目录双击03-update.cmd，不需重复下载。无需管理员运行，不推送、不合并、不发布。')
with ZipFile(output) as z:
    assert set(z.namelist()) == set(files) | {'文件校验.json', '请先阅读.txt'}
    for name, source in files.items():
        assert z.read(name) == (root / source).read_bytes()
print(f'PASS migration kit: {output.name}, {output.stat().st_size} bytes; only launcher/helpers/docs, no photos or credentials')
