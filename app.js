// Generate dynamic manifest with correct paths
const generateManifest = () => {
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const baseUrl = window.location.origin + basePath;
    
    const manifestData = {
        "name": "Secret Sharing PWA",
        "short_name": "SecretShare",
        "description": "Split and combine secrets using Shamir's Secret Sharing",
        "start_url": basePath || '/',
        "scope": basePath || '/',
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#0d6efd",
        "icons": [
            {
                "src": `${basePath}icon-192.png`,
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": `${basePath}icon-512.png`,
                "sizes": "512x512",
                "type": "image/png"
            },
            {
                "src": `${basePath}icon-512.png`,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable"
            }
        ]
    };
    
    const manifestBlob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);
    document.querySelector('#manifest-link').setAttribute('href', manifestURL);
};

generateManifest();

// PWA Install prompt handling
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install button
    installButton.style.display = 'block';
});

installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
        return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // Clear the deferredPrompt for garbage collection
    deferredPrompt = null;
    // Hide the install button
    installButton.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // Hide the install button
    installButton.style.display = 'none';
    deferredPrompt = null;
});

// Register service worker
if ('serviceWorker' in navigator) {
    const swPath = new URL('./sw.js', document.location).href;
    navigator.serviceWorker.register(swPath)
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}

// Initialize secrets.js
secrets.init();

// Helper functions for compression and encoding
function uint8ArrayToHex(uint8array) {
    return Array.from(uint8array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToUint8Array(hexString) {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
}

function hexToBech32Words(hexString) {
    const bytes = hexToUint8Array(hexString);
    return bech32.toWords(bytes);
}

function bech32WordsToHex(words) {
    const bytes = bech32.fromWords(words);
    return uint8ArrayToHex(new Uint8Array(bytes));
}

// QR Code chunking utilities
const MAX_QR_CHARS = 300; // Conservative limit for reliable scanning

function encodeShareToQRChunks(share) {
    if (share.length <= MAX_QR_CHARS) {
        return [share]; // Single QR code
    }
    
    const numChunks = Math.ceil(share.length / MAX_QR_CHARS);
    const chunks = [];
    
    for (let i = 0; i < numChunks; i++) {
        const start = i * MAX_QR_CHARS;
        const end = Math.min(start + MAX_QR_CHARS, share.length);
        const chunk = share.slice(start, end);
        
        // Format: PART{i+1}OF{numChunks}:{chunk}
        chunks.push(`PART${i+1}OF${numChunks}:${chunk}`);
    }
    
    return chunks;
}

function decodeQRChunks(scannedChunks) {
    // Handle single non-chunked share (backward compatibility)
    if (scannedChunks.length === 1 && !scannedChunks[0].match(/^PART\d+OF\d+:/)) {
        return scannedChunks[0];
    }
    
    // Sort by part number
    const sorted = scannedChunks.sort((a, b) => {
        const aMatch = a.match(/^PART(\d+)OF(\d+):/);
        const bMatch = b.match(/^PART(\d+)OF(\d+):/);
        if (!aMatch || !bMatch) {
            throw new Error('Invalid chunk format');
        }
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    });
    
    // Validate complete set
    const firstMatch = sorted[0].match(/^PART\d+OF(\d+):/);
    if (!firstMatch) {
        throw new Error('Invalid chunk format');
    }
    const totalParts = parseInt(firstMatch[1]);
    
    if (sorted.length !== totalParts) {
        throw new Error(`Incomplete share: need ${totalParts} parts, have ${sorted.length}`);
    }
    
    // Verify all part numbers are present
    for (let i = 0; i < totalParts; i++) {
        const match = sorted[i].match(/^PART(\d+)OF(\d+):/);
        if (!match || parseInt(match[1]) !== i + 1) {
            throw new Error(`Missing part ${i + 1} of ${totalParts}`);
        }
    }
    
    // Reconstruct share by removing prefixes and joining
    return sorted.map(chunk => chunk.replace(/^PART\d+OF\d+:/, '')).join('');
}

// State
let sharesNeeded = 2;
let totalShares = 3;
let shareCount = 2;

// Elements
const sharesNeededValue = document.getElementById('sharesNeededValue');
const totalSharesValue = document.getElementById('totalSharesValue');
const secretInput = document.getElementById('secretInput');
const sharesOutput = document.getElementById('sharesOutput');
const combineInputs = document.getElementById('combineInputs');
const combineResult = document.getElementById('combineResult');

// Split Tab - Counter controls
document.getElementById('sharesNeededMinus').addEventListener('click', () => {
    if (sharesNeeded > 2) {
        sharesNeeded--;
        if (sharesNeeded > totalShares) {
            totalShares = sharesNeeded;
            totalSharesValue.textContent = totalShares;
        }
        sharesNeededValue.textContent = sharesNeeded;
    }
});

document.getElementById('sharesNeededPlus').addEventListener('click', () => {
    sharesNeeded++;
    if (sharesNeeded > totalShares) {
        totalShares = sharesNeeded;
        totalSharesValue.textContent = totalShares;
    }
    sharesNeededValue.textContent = sharesNeeded;
});

document.getElementById('totalSharesMinus').addEventListener('click', () => {
    if (totalShares > sharesNeeded && totalShares > 2) {
        totalShares--;
        totalSharesValue.textContent = totalShares;
    }
});

document.getElementById('totalSharesPlus').addEventListener('click', () => {
    totalShares++;
    totalSharesValue.textContent = totalShares;
});

// Split functionality
document.getElementById('splitButton').addEventListener('click', () => {
    const secret = secretInput.value.trim();
    
    if (!secret) {
        sharesOutput.innerHTML = '<div class="alert alert-warning">Please enter a secret to split.</div>';
        return;
    }

    try {
        // 1. Compress the secret using pako
        const encoder = new TextEncoder();
        const secretBytes = encoder.encode(secret);
        const compressed = pako.deflate(secretBytes, { level: 9 });
        
        // 2. Convert compressed data to hex
        const compressedHex = uint8ArrayToHex(compressed);
        
        // 3. Generate Shamir shares (in hex)
        const hexShares = secrets.share(compressedHex, totalShares, sharesNeeded);
        
        // 4. Encode shares with bech32 (with checksum)
        const shares = hexShares.map((hexShare, index) => {
            // Extract components from hex share
            const shareObj = secrets.extractShareComponents(hexShare);
            
            // Convert only the data portion to bech32
            const words = hexToBech32Words(shareObj.data);
            
            // Create simple prefix s1, s2, s3, etc.
            const prefix = `s${index + 1}`;
            
            // Encode with bech32 (includes checksum)
            const bech32Encoded = bech32.encode(prefix, words, 5000);
            
            // Store bits and id for reconstruction
            const idLen = (Math.pow(2, shareObj.bits) - 1).toString(16).length;
            const idHex = shareObj.id.toString(16).padStart(idLen, '0');
            const metadata = shareObj.bits.toString(36).toUpperCase() + idHex;
            
            return metadata + bech32Encoded;
        });
        
        // Display shares with QR chunking support
        let html = '<h5 class="mb-3">Generated Shares:</h5>';
        shares.forEach((share, index) => {
            const chunks = encodeShareToQRChunks(share);
            const isMultiQR = chunks.length > 1;
            
            html += `
                <div class="share-item mb-3">
                    <div class="input-group mb-2">
                        <span class="input-group-text">Share ${index + 1}</span>
                        <input type="text" class="form-control" value="${share}" readonly>
                        <button class="btn btn-outline-secondary copy-share-btn" type="button" data-share="${share}">Copy</button>
                        <button class="btn btn-outline-info qr-toggle" type="button" data-index="${index}">
                            <span class="toggle-icon">+</span> ${isMultiQR ? `(${chunks.length} QRs)` : '(QR)'}
                        </button>
                    </div>
                    ${isMultiQR ? `<div class="alert alert-warning py-1 px-2 mb-2" style="font-size: 0.875rem;">⚠️ Large share: requires ${chunks.length} QR codes</div>` : ''}
                    <div class="qr-container" id="qr-${index}"></div>
                </div>
            `;
        });
        
        html += '<button class="btn btn-success mt-2 me-2" id="copyAllShares">Copy All Shares</button>';
        html += '<button class="btn btn-outline-secondary mt-2" id="printShares">Print Shares</button>';
        sharesOutput.innerHTML = html;
        
        // Add QR toggle event listeners with chunking support
        document.querySelectorAll('.qr-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                const qrContainer = document.getElementById(`qr-${index}`);
                const toggleIcon = e.currentTarget.querySelector('.toggle-icon');
                
                if (qrContainer.classList.contains('active')) {
                    // Hide QR codes
                    qrContainer.classList.remove('active');
                    qrContainer.innerHTML = '';
                    toggleIcon.textContent = '+';
                } else {
                    // Show QR code(s)
                    qrContainer.classList.add('active');
                    const chunks = encodeShareToQRChunks(shares[index]);
                    
                    if (chunks.length === 1) {
                        // Single QR code
                        qrContainer.innerHTML = `<div id="qrcode-${index}"></div>`;
                        new QRCode(document.getElementById(`qrcode-${index}`), {
                            text: chunks[0],
                            width: 256,
                            height: 256,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.M
                        });
                    } else {
                        // Multiple QR codes
                        let qrHtml = '<div class="d-flex flex-wrap gap-3">';
                        chunks.forEach((chunk, chunkIdx) => {
                            qrHtml += `
                                <div class="text-center">
                                    <div class="mb-2 fw-bold">Part ${chunkIdx + 1} of ${chunks.length}</div>
                                    <div id="qrcode-${index}-${chunkIdx}"></div>
                                </div>
                            `;
                        });
                        qrHtml += '</div>';
                        qrContainer.innerHTML = qrHtml;
                        
                        // Generate each QR code
                        chunks.forEach((chunk, chunkIdx) => {
                            new QRCode(document.getElementById(`qrcode-${index}-${chunkIdx}`), {
                                text: chunk,
                                width: 200,
                                height: 200,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.M
                            });
                        });
                    }
                    
                    toggleIcon.textContent = '-';
                }
            });
        });
        
        // Add copy event listeners
        document.querySelectorAll('.copy-share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const share = e.target.getAttribute('data-share');
                copyToClipboard(share);
                e.target.textContent = 'Copied!';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
            });
        });
        
        document.getElementById('copyAllShares').addEventListener('click', () => {
            const allShares = shares.join('\n');
            copyToClipboard(allShares);
            document.getElementById('copyAllShares').textContent = 'Copied!';
            setTimeout(() => { document.getElementById('copyAllShares').textContent = 'Copy All Shares'; }, 2000);
        });
        
        document.getElementById('printShares').addEventListener('click', () => {
            // Create print window
            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Secret Shares</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 0px;
                        }
                        .share-section {
                            margin-bottom: 40px;
                            page-break-inside: avoid;
                        }
                        .share-title {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 10px;
                        }
                        .share-text {
                            font-family: monospace;
                            font-size: 12px;
                            word-break: break-all;
                            margin-bottom: 15px;
                            padding: 10px;
                            background: #f5f5f5;
                            border: 1px solid #ddd;
                        }
                        /* QR code container for multi-part shares */
                        .print-qr-container {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 20px;
                            justify-content: center;
                            align-items: flex-start;
                            margin-top: 20px;
                        }
                        .print-qr-part {
                            text-align: center;
                            flex: 0 0 auto;
                        }
                        .print-qr-part-label {
                            font-weight: bold;
                            margin-bottom: 10px;
                            font-size: 14px;
                        }
                        .print-qr-code {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 10px;
                        }
                        .print-qr-code canvas,
                        .print-qr-code img {
                            max-width: 100%;
                            width: 100%;
                            height: auto;
                            display: block;
                        }
                        @media print {
                            .share-section {
                                page-break-after: always;
                            }
                            .share-section:last-child {
                                page-break-after: auto;
                            }
                        }
                    </style>
                    <script src="${window.location.origin}/qrcode.min.js"></script>
                </head>
                <body>
            `);
            
            shares.forEach((share, index) => {
                const chunks = encodeShareToQRChunks(share);
                const isMultiPart = chunks.length > 1;
                
                printWindow.document.write(`
                    <div class="share-section">
                        <div class="share-title" style="padding-top:20px;">Share ${index + 1}${isMultiPart ? ` (${chunks.length} parts)` : ''}:</div>
                        <p>Generated on ${new Date().toLocaleString()}</p>
                        <div class="share-text">${share}</div>
                        <div class="print-qr-container" id="print-qr-container-${index}">
                `);
                
                // Add QR code placeholders for each chunk
                chunks.forEach((chunk, chunkIdx) => {
                    printWindow.document.write(`
                        <div class="print-qr-part">
                            ${isMultiPart ? `<div class="print-qr-part-label">Part ${chunkIdx + 1} of ${chunks.length}</div>` : ''}
                            <div class="print-qr-code" id="print-qr-${index}-${chunkIdx}"></div>
                        </div>
                    `);
                });
                
                printWindow.document.write(`
                        </div>
                    </div>
                `);
            });
            
            printWindow.document.write(`
                </body>
                </html>
            `);
            printWindow.document.close();
            
            // Wait for document to load, then generate QR codes and print
            printWindow.onload = () => {
                shares.forEach((share, index) => {
                    const chunks = encodeShareToQRChunks(share);
                    chunks.forEach((chunk, chunkIdx) => {
                        new QRCode(printWindow.document.getElementById(`print-qr-${index}-${chunkIdx}`), {
                            text: chunk,
                            width: 256,
                            height: 256,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.M
                        });
                    });
                });
                
                // Give QR codes time to render before printing
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
        });
        
    } catch (error) {
        sharesOutput.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
});

// Combine Tab - Add share input
document.getElementById('addShareButton').addEventListener('click', () => {
    shareCount++;
    const newInput = document.createElement('div');
    newInput.className = 'mb-3 share-input-group';
    newInput.innerHTML = `
        <div class="d-flex align-items-start gap-2">
            <div class="flex-grow-1">
                <label class="form-label">Share ${shareCount}:</label>
                <div class="input-group">
                    <button class="btn btn-outline-secondary scan-qr-btn" type="button" title="Scan QR Code">📸</button>
                    <input type="text" class="form-control share-input" placeholder="Paste share here or scan QR code(s)...">
                </div>
                <small class="text-muted share-hint">Supports multi-part QR codes</small>
            </div>
            <button class="btn btn-outline-danger remove-share-btn" type="button" style="margin-top: 32px;">Remove</button>
        </div>
    `;
    combineInputs.appendChild(newInput);
    
    // Add remove event listener
    newInput.querySelector('.remove-share-btn').addEventListener('click', () => {
        const allGroups = document.querySelectorAll('.share-input-group');
        if (allGroups.length > 2) {
            newInput.remove();
            updateShareLabels();
        }
    });
    
    // Attach scan listener to new button
    attachScanListeners();
});

// Update share labels after removal
function updateShareLabels() {
    const allGroups = document.querySelectorAll('.share-input-group');
    allGroups.forEach((group, index) => {
        const label = group.querySelector('.form-label');
        if (label) {
            label.textContent = `Share ${index + 1}:`;
        }
    });
    shareCount = allGroups.length;
}

// Combine functionality
document.getElementById('combineButton').addEventListener('click', () => {
    const shareInputs = document.querySelectorAll('.share-input');
    const rawShares = [];
    
    shareInputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            rawShares.push(value);
        }
    });
    
    if (rawShares.length < 2) {
        combineResult.innerHTML = '<div class="result-box result-error">Please enter at least 2 shares.</div>';
        return;
    }
    
    try {
        // Process shares - handle both chunked (PART format) and non-chunked shares
        // Note: User might manually paste chunks separated by newlines or spaces
        const shares = rawShares.map((rawShare, idx) => {
            // Check if input contains multiple chunks (user manually pasted all parts)
            const lines = rawShare.split(/[\n\r]+/).map(l => l.trim()).filter(l => l);
            
            if (lines.length > 1 && lines.every(l => l.match(/^PART\d+OF\d+:/))) {
                // Multiple chunks pasted - reassemble them
                try {
                    return decodeQRChunks(lines);
                } catch (e) {
                    throw new Error(`Share ${idx + 1}: ${e.message}`);
                }
            } else if (rawShare.match(/^PART\d+OF\d+:/)) {
                // Single chunk - incomplete share
                const match = rawShare.match(/^PART\d+OF(\d+):/);
                const totalParts = match ? match[1] : '?';
                throw new Error(`Share ${idx + 1} is incomplete (needs ${totalParts} parts total)`);
            } else {
                // Normal single-QR share
                return rawShare;
            }
        });
        
        // 1. Decode bech32 shares and reconstruct hex format
        const hexShares = shares.map((share, idx) => {
            try {
                // Find where bech32 part starts (after metadata, looks for 's' prefix)
                const bech32Start = share.search(/s\d+1/);
                if (bech32Start === -1) {
                    throw new Error('Invalid share format');
                }
                
                const metadata = share.substring(0, bech32Start);
                const bech32Encoded = share.substring(bech32Start);
                
                // Extract bits and id from metadata
                const bits = parseInt(metadata.charAt(0), 36);
                const idLen = (Math.pow(2, bits) - 1).toString(16).length;
                const idHex = metadata.substring(1, 1 + idLen);
                
                // Decode bech32 (validates checksum)
                const decoded = bech32.decode(bech32Encoded, 5000);
                
                // Convert bech32 words back to hex
                const hexData = bech32WordsToHex(decoded.words);
                
                // Reconstruct full hex share
                return metadata.charAt(0) + idHex + hexData;
            } catch (e) {
                throw new Error(`Share ${idx + 1} decode failed: ${e.message}`);
            }
        });
        
        // 2. Combine Shamir shares
        const compressedHex = secrets.combine(hexShares);
        
        // 3. Convert hex to Uint8Array
        const compressedBytes = hexToUint8Array(compressedHex);
        
        // 4. Decompress using pako
        const decompressed = pako.inflate(compressedBytes);
        
        // 5. Convert back to string
        const decoder = new TextDecoder();
        const recoveredSecret = decoder.decode(decompressed);
        
        // Detect file type based on content
        const fileTypeInfo = detectFileType(recoveredSecret);
        
        combineResult.innerHTML = `
            <div class="result-box result-success">
            <button class="btn btn-primary me-2" id="downloadSecretBtn">↓ ${fileTypeInfo.buttonLabel}</button>
                <h5>Secret reconstructed:</h5>
                <p class="mb-3" style="word-break: break-word;">${escapeHtml(recoveredSecret)}</p>
                <button class="btn btn-success" id="copySecretBtn">Copy Secret</button>
            </div>
        `;
        
        // Add download button listener
        document.getElementById('downloadSecretBtn').addEventListener('click', () => {
            downloadTextFile(recoveredSecret, fileTypeInfo.filename);
        });
        
        // Add copy secret button listener
        document.getElementById('copySecretBtn').addEventListener('click', () => {
            copyToClipboard(recoveredSecret);
            document.getElementById('copySecretBtn').textContent = 'Copied!';
            setTimeout(() => { document.getElementById('copySecretBtn').textContent = 'Copy Secret'; }, 2000);
        });
        
    } catch (error) {
        combineResult.innerHTML = `<div class="result-box result-error">Unable to combine: ${error.message || 'Invalid or insufficient shares.'}</div>`;
    }
});

// Utility functions
function detectFileType(content) {
    // Check for BSMS wallet configuration
    if (/^BSMS\s+\d+\.\d+/i.test(content)) {
        return {
            extension: 'bsms',
            filename: 'wallet-config.bsms',
            buttonLabel: 'Download Wallet Configuration'
        };
    }
    
    // Add more file type detections here in the future
    // Example patterns:
    // - JSON: if (content.trim().startsWith('{') && content.trim().endsWith('}'))
    // - Bitcoin private key: if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(content.trim()))
    // - etc.
    
    // Default to plain text
    return {
        extension: 'txt',
        filename: 'secret.txt',
        buttonLabel: 'Download as Text File'
    };
}

function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// QR Scanner functionality with multi-part support
let qrScanner = null;
let currentScanInput = null;
let scannedChunks = []; // Store chunks for current share
let expectedChunkCount = 0; // Total chunks expected for current share

function initQrScanner() {
    const video = document.getElementById('qr-video');
    const modal = document.getElementById('qr-scanner-modal');
    const closeBtn = document.getElementById('qr-scanner-close');
    
    qrScanner = new QrScanner(
        video,
        result => {
            // On successful scan
            if (currentScanInput) {
                handleQRScan(result.data);
            }
        },
        {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // Maximize scan area for dense QR codes
            calculateScanRegion: (video) => {
                // Use the largest possible square from the video frame
                const width = video.videoWidth;
                const height = video.videoHeight;
                const size = Math.min(width, height);
                
                // Center the square region
                const x = (width - size) / 2;
                const y = (height - size) / 2;
                
                // Use higher resolution downscaling (800x800) for better detail capture
                const downScaledSize = Math.min(800, size);
                
                return {
                    x: x,
                    y: y,
                    width: size,
                    height: size,
                    downScaledWidth: downScaledSize,
                    downScaledHeight: downScaledSize
                };
            },
        }
    );
    
    // Close button handler
    closeBtn.addEventListener('click', stopScanner);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            stopScanner();
        }
    });
}

function handleQRScan(data) {
    // Check if this is a chunked share
    const chunkMatch = data.match(/^PART(\d+)OF(\d+):/);
    
    if (chunkMatch) {
        // Multi-part share
        const partNum = parseInt(chunkMatch[1]);
        const totalParts = parseInt(chunkMatch[2]);
        
        // Initialize chunk tracking if this is the first chunk
        if (scannedChunks.length === 0) {
            expectedChunkCount = totalParts;
            updateScannerFeedback(`Scanned part 1 of ${totalParts}. Scan ${totalParts - 1} more.`);
        }
        
        // Validate this chunk belongs to the same share
        if (totalParts !== expectedChunkCount) {
            updateScannerFeedback(`Error: Expected ${expectedChunkCount} parts but this QR has ${totalParts} parts. Please scan the correct share.`, true);
            return;
        }
        
        // Check for duplicate chunks
        const existingChunk = scannedChunks.find(c => c.match(/^PART(\d+)OF\d+:/)[1] === partNum.toString());
        if (existingChunk) {
            updateScannerFeedback(`Part ${partNum} already scanned. Scan remaining parts.`, false);
            return;
        }
        
        // Add chunk to collection
        scannedChunks.push(data);
        
        // Update feedback
        const remaining = totalParts - scannedChunks.length;
        if (remaining > 0) {
            updateScannerFeedback(`Scanned part ${partNum} of ${totalParts}. Scan ${remaining} more.`);
        } else {
            // All chunks collected, reassemble
            try {
                const fullShare = decodeQRChunks(scannedChunks);
                currentScanInput.value = fullShare;
                updateScannerFeedback(`✓ Complete! All ${totalParts} parts scanned.`, false);
                
                // Close scanner after short delay
                setTimeout(() => {
                    stopScanner();
                }, 1500);
            } catch (e) {
                updateScannerFeedback(`Error reassembling share: ${e.message}`, true);
            }
        }
    } else {
        // Single QR code (no chunking)
        currentScanInput.value = data;
        updateScannerFeedback('✓ Share scanned successfully!', false);
        setTimeout(() => {
            stopScanner();
        }, 1000);
    }
}

function updateScannerFeedback(message, isError = false) {
    const modal = document.getElementById('qr-scanner-modal');
    let feedbackEl = modal.querySelector('.scanner-feedback');
    
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.className = 'scanner-feedback';
        feedbackEl.style.cssText = 'color: white; text-align: center; margin-top: 1rem; padding: 0.5rem; font-weight: bold; border-radius: 4px;';
        
        const videoContainer = modal.querySelector('.qr-scanner-content');
        const existingText = videoContainer.querySelector('p');
        if (existingText) {
            existingText.remove();
        }
        videoContainer.appendChild(feedbackEl);
    }
    
    feedbackEl.textContent = message;
    feedbackEl.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.8)' : 'rgba(25, 135, 84, 0.8)';
}

function startScanner(inputElement) {
    currentScanInput = inputElement;
    scannedChunks = []; // Reset chunks
    expectedChunkCount = 0; // Reset expected count
    
    const modal = document.getElementById('qr-scanner-modal');
    modal.classList.add('active');
    
    // Reset feedback
    const feedbackEl = modal.querySelector('.scanner-feedback');
    if (feedbackEl) {
        feedbackEl.remove();
    }
    
    // Re-add instruction text
    const videoContainer = modal.querySelector('.qr-scanner-content');
    if (!videoContainer.querySelector('p')) {
        const instruction = document.createElement('p');
        instruction.style.cssText = 'color: white; text-align: center; margin-top: 1rem;';
        instruction.textContent = 'Position QR code within the camera view';
        videoContainer.appendChild(instruction);
    }
    
    if (qrScanner) {
        qrScanner.start().catch(err => {
            alert('Failed to start camera: ' + err.message);
            stopScanner();
        });
    }
}

function stopScanner() {
    const modal = document.getElementById('qr-scanner-modal');
    modal.classList.remove('active');
    
    if (qrScanner) {
        qrScanner.stop();
    }
    
    currentScanInput = null;
    scannedChunks = [];
    expectedChunkCount = 0;
}

// Initialize QR scanner on page load
initQrScanner();

// Add scan button event listeners to existing inputs
function attachScanListeners() {
    document.querySelectorAll('.scan-qr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.target.closest('.input-group').querySelector('.share-input');
            startScanner(input);
        });
    });
}

attachScanListeners();
