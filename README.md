# Secret Sharing PWA

A progressive web app for securely splitting secrets using Shamir's Secret Sharing with compression and error detection.

## What is it?

This PWA allows you to split sensitive data (like Bitcoin wallet configurations, passwords, or private keys) into multiple shares using [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing). Each share can be stored at different locations, and you need a minimum threshold of shares to reconstruct the original secret.

**Key Features:**

- **Compression**: Uses pako (zlib) to compress data before splitting, reducing share size by 40-60%
- **Error Detection**: Bech32 encoding with checksums validates share integrity
- **QR Codes**: Generate QR codes for each share for easy paper backup
- **Offline-First**: Works completely offline after initial load - no internet required
- **Print Support**: Print shares with QR codes for physical backup storage
- **Dark Mode**: Easy-on-the-eyes dark interface

## Use Cases

- **Bitcoin Wallet Backups**: Split BSMS wallet configurations (e.g., 2-of-3 multisig with timelocks) across multiple locations
- **Password Recovery**: Create distributed backups of master passwords
- **Key Storage**: Split private keys for cold storage redundancy
- **Family Recovery**: Enable family members to collectively recover important data without any single person having full access

## How to Use

### Split a Secret

1. Open the app and navigate to the **Split** tab
2. Enter your secret text in the input field
3. Configure the threshold:
   - **Shares needed**: Minimum number of shares required to reconstruct (default: 2)
   - **Of total**: Total number of shares to create (default: 3)
4. Click **Split**
5. Your shares will be displayed with options to:
   - Copy individual shares
   - Copy all shares at once
   - Generate QR codes (click +/- buttons)
   - Print shares with QR codes

**Example Share Format:**
```
801s11qpzry9x8gf2tvdw0s3jn54khce6mua7l...
```
- `801`: Metadata (bits + share ID)
- `s1`: Bech32 prefix identifying share number
- Remaining: Compressed, encoded data with checksum

### Combine Shares

1. Navigate to the **Combine** tab
2. Paste at least the threshold number of shares into the input fields
3. Click **+ Add Share** if you need more input fields
4. Click **Combine**
5. Your original secret will be reconstructed and displayed
6. Click **Copy Secret** to copy it to clipboard

## Installation

### Run Locally

1. Clone this repository:
   ```bash
   git clone https://[REPO_URL]/SecretSharePWA.git
   cd SecretSharePWA
   ```

2. Open in browser
  
   Open index.html from filesystem or Start a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server -p 8000
   
   # Or using Nix
   nix run nixpkgs#python3 -- -m http.server 8000
   ```

3. Open http://localhost:8000 in your browser

### Install as PWA

1. Open the app in a modern browser (Chrome, Firefox, Safari, Edge)
2. Click the install prompt or use browser's "Install App" option
3. The app will act as a native application

## Security Notes

- **This code is provided as-is without warranty**
- All processing happens in your browser - nothing is sent to any server
- For maximum security, use the app offline on an air-gapped device
- Store shares in different physical locations
- Test recovery before relying on shares for critical data
- The compression and encoding reduces size but does not add encryption
- Shamir's Secret Sharing provides security through share distribution, not cryptographic encryption

## Technical Details

### Data Flow

**Split Process:**
1. UTF-8 encode the secret text
2. Compress with pako.deflate (level 9)
3. Convert to hexadecimal
4. Split using Shamir's Secret Sharing
5. Encode each share with Bech32 (adds checksum)

**Combine Process:**
1. Decode Bech32 shares (validates checksums)
2. Reconstruct using Shamir's Secret Sharing
3. Convert from hexadecimal to bytes
4. Decompress with pako.inflate
5. UTF-8 decode to original text

### File Structure

```
SecretSharePWA/
├── index.html          # Main app interface
├── app.js              # Application logic
├── sw.js               # Service worker for offline support
├── manifest.json       # PWA manifest
├── icon-*.png/svg      # App icons
└── lib/                # Third-party libraries
    ├── secrets/        # Shamir's Secret Sharing implementation
    ├── pako/           # Compression library
    ├── bech32/         # Bech32 encoding with checksums
    ├── qrcode/         # QR code generation
    └── bootstrap/      # UI framework
```

## Credits

This project is built using the following open-source libraries:

### [secrets.js](https://github.com/grempe/secrets.js)
Implementation of Shamir's Secret Sharing scheme in JavaScript.
- **License**: MIT
- **Usage**: Core secret splitting and reconstruction

### [Bootstrap](https://getbootstrap.com/)
Front-end framework for responsive web design.
- **License**: MIT
- **Version**: 5.3.8
- **Usage**: UI components and styling

### [bitcoinjs/bech32](https://github.com/bitcoinjs/bech32)
Bech32 encoding library with checksum validation.
- **License**: MIT
- **Usage**: Error detection via checksummed encoding

### [pako](https://github.com/nodeca/pako)
High-speed zlib port to JavaScript.
- **License**: MIT & Zlib
- **Usage**: Data compression to reduce share sizes

### [QRCode for JavaScript](https://github.com/davidshimjs/qrcodejs)
QR code generation library.
- **License**: MIT
- **Usage**: Generate QR codes for shares

### [qr-scanner](https://github.com/nimiq/qr-scanner)
Lightweight QR code scanner for the browser.
- **License**: MIT
- **Usage**: Scan QR codes with device camera

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Disclaimer

This software is provided "as-is" without any warranty. Use at your own risk. Always test recovery procedures before relying on this tool for critical data. The authors are not responsible for any loss of data or funds.
