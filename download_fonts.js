const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, 'src_v2', 'assets', 'fonts');

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(resolve);
            });
        }).on('error', function (err) {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function processCssFile(cssFilePath) {
    if (!fs.existsSync(cssFilePath)) {
        console.warn(`File not found: ${cssFilePath}`);
        return;
    }
    let cssObj = fs.readFileSync(cssFilePath, 'utf8');
    const urlRegex = /url\((https:\/\/[^)]+)\)/g;
    let match;
    let newCss = cssObj;
    
    const downloads = [];
    
    while ((match = urlRegex.exec(cssObj)) !== null) {
        let fullUrl = match[1].replace(/['"]/g, ''); // parse out quotes if any
        if (fullUrl.startsWith('//')) {
            fullUrl = 'https:' + fullUrl;
        }
        const fileName = fullUrl.split('/').pop().split('?')[0].split('#')[0]; // robust filename parsing
        const localPath = path.join(fontsDir, fileName);
        
        console.log(`Downloading ${fileName}...`);
        downloads.push(download(fullUrl, localPath));
        
        // Replace in CSS with relative path
        newCss = newCss.replace(match[1], `./${fileName}`);
    }
    
    await Promise.all(downloads);
    fs.writeFileSync(cssFilePath, newCss);
    console.log(`Processed ${path.basename(cssFilePath)}`);
}

async function fetchOswald() {
    const oswaldUrl = 'https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap';
    console.log(`Fetching Oswald CSS from ${oswaldUrl}`);
    return new Promise((resolve, reject) => {
        let cssData = '';
        https.get(oswaldUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (res) => { 
            res.on('data', d => cssData += d);
            res.on('end', () => {
                const oswaldPath = path.join(fontsDir, 'oswald.css');
                fs.writeFileSync(oswaldPath, cssData);
                resolve(oswaldPath);
            });
        }).on('error', reject);
    });
}

async function run() {
    const files = ['inter.css', 'space-grotesk.css', 'material-symbols.css'];
    for (const f of files) {
        await processCssFile(path.join(fontsDir, f));
    }
    
    const oswaldCssPath = await fetchOswald();
    await processCssFile(oswaldCssPath);
    console.log('All fonts downloaded and CSS files updated successfully!');
}

run().catch(console.error);
