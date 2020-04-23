# WeiboPictureDownload

## How to use

#### Download
```text
git clone https://github.com/MunMunMiao/WeiboPictureDownload.git
```

#### Install dependencies
```text
npm install
```

#### Quick start
```text
node weibo.js -c XXXXX -u 518178935
```

## Options
```text
Usage: weibo [options]

Options:
  -c, --cookie <string>     Weibo SUB
  -u, --uid <number>        Weibo user object id
  -d, --directory <string>  Output directory (default: "./")
  -t, --threads <number>    Download threads (default: 10)
  -o, --output-file         Output files
  -i, --interval <number>   Analyze interval (default: 800)
  -h, --help                output usage information
```
