# Security

Aurora PDF supports password protection and permission restrictions through the encryption adapter.

## Passwords

- `userPassword`: required to open the PDF.
- `ownerPassword`: required to change permissions.

If `ownerPassword` is omitted, the encryption backend uses its own default behavior.

## Permissions

Supported permission switches:

- printing
- modifying
- copying
- annotating
- filling forms
- extraction
- assembly
- high quality print

PDF permissions are advisory in the PDF standard. Compliant readers enforce them, but malicious or non-compliant tools may ignore them. Do not use PDF permissions as the only layer for sensitive data protection.

## Metadata Protection

`EncryptOptions.protectMetadata` is reserved in the public contract. The current adapter protects the encrypted document body and permission dictionary. For strict metadata redaction, call `optimize(input, { stripMetadata: true })` before encryption.

## Temporary Files

`createSecureTempDir` creates a private temporary directory and returns an explicit cleanup function. Library internals prefer byte streams and secure writes to avoid unnecessary durable temporary files.

## Operational Recommendations

- Store passwords outside source code.
- Generate owner passwords with a secret manager.
- Strip metadata before encryption when document identity must be hidden.
- Prefer AES-256 unless a legacy PDF reader requires RC4.
- Restrict access to generated PDFs at the application storage layer too.
