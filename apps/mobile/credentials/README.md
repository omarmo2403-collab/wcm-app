# iOS credentials (local only — never committed)

Drop the **App Store Connect API key** here:

    apps/mobile/credentials/AuthKey_<KEYID>.p8

`*.p8` is gitignored, so this file stays on your machine. EAS reads it locally
to authenticate to Apple (create signing certs/profiles, submit builds) without
an Apple ID password or 2FA.

You give Claude only the **Key ID** and **Issuer ID** (plain identifiers, not
secrets). The `.p8` itself never leaves your disk.
