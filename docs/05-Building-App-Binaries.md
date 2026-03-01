# 05. Building App Binaries

Ink & Quill is built to automatically generate native application binaries for macOS, Windows, and Linux whenever you push a new release to GitHub. This process is handled by a Continuous Integration (CI) pipeline powered by **GitHub Actions**.

Because each operating system uses different packaging tools (e.g., Xcode for `.dmg`, WiX for `.msi`, and dpkg for `.deb`), the build happens across multiple distinct "virtual machines" on GitHub's servers rather than directly on your computer.

***

## How the Build Pipeline Works

1. **Triggering the Build**: The build process runs whenever you manually execute the Action or when you push a Git tag starting with `v` (like `v1.0.0`).
2. **Matrix Build**: GitHub Provisions three separate runner environments:
   - `macos-latest` (builds the `.dmg` and `.app` for macOS)
   - `windows-latest` (builds the `.msi` and `.nsis` for Windows)
   - `ubuntu-22.04` (builds the `.deb` and `.AppImage` for Linux)
3. **Environment Setup**: Inside each environment, the script automatically installs Node.js, `pnpm` (your package manager), the stable Rust toolchain (required for Tauri), and any native OS libraries needed (like webkit2gtk on Ubuntu).
4. **Compilation**: The Action runs `pnpm install` and then `pnpm tauri build`, which compiles the React frontend and packages it into the Rust-based Tauri webview wrapper.
5. **Release Upload**: Once finished, the native installers are uploaded and attached to a new Draft Release inside your repository's "Releases" section.

***

## How to Trigger a Build Manually

You can manually kick off the build pipeline from your web browser or from the command line:

### Method 1: GitHub CLI (Recommended)
1. Open your terminal in the project directory.
2. Run the following command:
   ```bash
   gh workflow run release.yml
   ```
3. To monitor its progress, you can run:
   ```bash
   gh run list --workflow="release.yml"
   ```

### Method 2: GitHub Web Interface
1. Navigate to your repository on [GitHub.com](https://github.com/).
2. Click on the **Actions** tab at the top.
3. In the left sidebar, click on **Release Tauri Apps**.
4. On the right side of the screen, click the **Run workflow** dropdown button.
5. Leave the branch set to `main` and click the green **Run workflow** button.

***

## How to Trigger a Build Automatically (via Git Tags)

If you are ready to publish a new official version, the best practice is to tag your release.

1. Commit your codebase changes:
   ```bash
   git add .
   git commit -m "feat: adding new document features"
   ```
2. Create an annotated git tag (make sure it starts with 'v'):
   ```bash
   git tag v0.3.0
   ```
3. Push the commit and the tag to GitHub:
   ```bash
   git push origin main
   git push origin v0.3.0
   ```
Once pushed, GitHub Actions will detect the newly created `v0.3.0` tag and start the pipeline automatically.

***

## Downloading Your Binaries

1. Go to your GitHub repository in your web browser.
2. Look at the right sidebar and click on **Releases**.
3. You will see a new release (it might be marked as a **Draft**).
4. Expand the **Assets** dropdown at the bottom of the release notes.
5. Download the installer for your specific operating system:
   - **Mac**: Download the `.dmg` file.
   - **Windows**: Download the `.msi` or `.nsis` file.
   - **Linux**: Download the `.deb` file (Debian/Ubuntu) or `.AppImage` (Universal).

> **Wait Time:** Keep in mind that building Rust and C++ dependencies from scratch across three different operating systems takes a bit of time! A full build typically takes between **10 to 15 minutes** to complete.
