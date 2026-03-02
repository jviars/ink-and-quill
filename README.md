# 🖋️ Ink & Quill

Hey there! Thanks for checking out **Ink & Quill**! 👋

This is a desktop writing application built to help you create, edit, and organize your writing projects. It comes with a powerful outliner, customizable themes, and saves your work locally as `.quill` files. 

**An app in 2026 that doesn’t have AI integration? Yes.** 

There’s likely to be a lot of issues and I’m sorry about that, this is just a passion project that I was trying. Thank you so much for checking it out, hope that it can help you! 

---

### 🎯 Project Goals

The long-term vision for Ink & Quill is to:
- Squash all the bugs 🐛
- Add a wider variety of themes 🎨
- Introduce more extensibility and customization 🧩
- Improve performance and allow the app to handle significantly more words in a single document ⚡️

**However, the primary goal will always remain the same: keep the core app simple, beautiful, and reliable.**

---

### ✍️ Calling All Writers!

If you are a writer, **I need you!** I've wanted to write a story, but admittedly, I haven't been able to finish one yet and I'm not aware of every capability that other apps like Scrivener have. 

Please reach out and tell me if a feature that you use in other writing apps is missing here or is not working quite right. Your feedback is what will make this app great!

---

### 🛠️ Built With

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

<img width="1790" height="1062" alt="quill1" src="https://github.com/user-attachments/assets/508eb293-857f-4492-8eda-ce65be87dd12" />
<img width="1792" height="1056" alt="quill2" src="https://github.com/user-attachments/assets/7ebfb6fe-a33b-4394-ab95-4c0e6a85f5a0" />


---

### ⚠️ A Quick Note on Compatibility

This app was tested on **Windows**, **macOS**, and **Debian**. Any of the other binaries were outputted by Tauri and I can’t guarantee their functionality.

This app was created with the intent that it will be used with Tauri. I can’t guarantee it will work any other way, but it is a web app nonetheless. 

### 🍏 macOS Installation Nuance

Because this is a passion project and currently unsigned, macOS might throw a "damaged app" error when you try to open it. 

For now, you’ll have to install the app on macOS by running the following command in your terminal to clear the Apple quarantine flag:

```bash
xattr -cr /Applications/Ink\ and\ Quill.app
```

*(Note: Adjust the path if you didn't place it in your main Applications folder!)*

☕ **If you’d like to help me get an Apple Developer account to sign my apps, please feel free to buy me a coffee! The goal is $99 for the year. Thanks so much.**

---

### 💻 Development

Want to tinker with the code? Awesome! 
*(Just a quick heads-up: I'm more biased towards macOS since that's what I work on, so development might feel most natural there!)*

**Prerequisites:**
- Node.js 18+
- Rust
- Platform-specific requirements for Tauri (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

**Getting Started:**
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   # For web development
   npm run dev
   
   # For Tauri desktop app development
   npm run tauri:dev
   ```

**Building:**
```bash
# Build the web version
npm run build

# Build the desktop app
npm run tauri:build
```

---

### 📜 License
MIT
