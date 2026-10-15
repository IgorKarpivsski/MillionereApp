"""Points the release build at the upload key (after `expo prebuild`).

Reads the key path and password from env (UPLOAD_KEYSTORE, UPLOAD_KEY_PASSWORD)
at build time, so nothing secret is written into the project files.
"""
import pathlib, sys

p = pathlib.Path(sys.argv[1])
s = p.read_text()
cfg = """    signingConfigs {
        upload {
            storeFile file(System.getenv('UPLOAD_KEYSTORE'))
            storePassword System.getenv('UPLOAD_KEY_PASSWORD')
            keyAlias 'upload'
            keyPassword System.getenv('UPLOAD_KEY_PASSWORD')
        }
"""
assert "    signingConfigs {\n" in s, "signingConfigs block not found"
s = s.replace("    signingConfigs {\n", cfg, 1)
rel = s.index("release {", s.index("buildTypes {"))
end = s.index("signingConfig signingConfigs.debug", rel)
s = s[:end] + "signingConfig signingConfigs.upload" + s[end + len("signingConfig signingConfigs.debug"):]
p.write_text(s)
print("release build signed with the upload key")
