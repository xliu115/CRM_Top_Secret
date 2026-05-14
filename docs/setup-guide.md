# ClientIQ -- Setup Guide

This guide walks you through getting the ClientIQ platform running on your computer. No prior coding experience needed -- just follow each step in order.

---

## Quick Start (Copy & Paste)

Already have Node.js and Git installed? Copy this entire block into your Terminal and press Enter:

```bash
cd ~/Desktop && \
git clone https://github.com/McK-Internal/CRM_Experimentation.git && \
cd CRM_Experimentation && \
npm install && \
cp .env.example .env && \
echo "✅ Dependencies installed. Now edit .env with your OpenAI API key, then run the commands below."
```

After you've added your API key to the `.env` file, copy and run this:

```bash
cd ~/Desktop/CRM_Experimentation && \
npx prisma migrate dev --name init && \
npx prisma db seed && \
npm run dev
```

Then open **http://localhost:3000** in your browser. That's it!

> If anything goes wrong, follow the detailed step-by-step guide below.

---

## Everyday Commands (Copy & Paste)

| Task | Copy this command |
|------|-------------------|
| **Start the app** | `cd ~/Desktop/CRM_Experimentation && npm run dev` |
| **Stop the app** | Press `Ctrl + C` in Terminal |
| **Get latest updates** | `cd ~/Desktop/CRM_Experimentation && git pull && npm install && npm run dev` |
| **Reset the database** | `cd ~/Desktop/CRM_Experimentation && npx prisma migrate dev && npx prisma db seed` |

---

## Detailed Step-by-Step Guide

> New to this? Follow each step below in order.

---

## What You'll Need Before Starting

- A Mac or Windows computer
- About 20 minutes
- The OpenAI API key (ask Xinyu if you don't have one)
- Access to the GitHub repository (ask Xinyu to add you as a collaborator)

---

## Step 1: Install Node.js

Node.js is the engine that runs the application. You only need to do this once.

1. Go to https://nodejs.org
2. Download the version labeled **"LTS"** (the one on the left with the green button)
3. Open the downloaded file and follow the installer prompts -- just keep clicking "Next" / "Continue" until it finishes

To confirm it worked, open **Terminal** (on Mac: search "Terminal" in Spotlight) or **Command Prompt** (on Windows: search "cmd") and type:

```
node -v
```

You should see a version number like `v22.22.1`. Any version starting with 18 or higher is fine.

---

## Step 2: Install a Code Editor

You'll need an editor to view and occasionally edit files. We recommend **Cursor** (which you may already have) or **VS Code**.

- Cursor: https://cursor.com
- VS Code: https://code.visualstudio.com

Download and install whichever you prefer.

---

## Step 3: Download the Project

Open Terminal (or Command Prompt) and run these commands one at a time. Each line is a separate command -- press Enter after each one.

```
cd ~/Desktop
git clone https://github.com/McK-Internal/CRM_Experimentation.git
cd CRM_Experimentation
```

This downloads the project to your Desktop in a folder called `CRM_Experimentation`.

> **If you see "git: command not found"**: Install Git from https://git-scm.com/downloads, then try again.

> **If you see "Permission denied" or "Repository not found"**: Ask Xinyu to add your GitHub account as a collaborator on the repository.

---

## Step 4: Install the App's Dependencies

Still in Terminal, run:

```
npm install
```

This downloads all the libraries the app needs. It may take a minute or two. You'll see a lot of text scrolling -- that's normal. Wait until you see your cursor blinking on a new line again.

---

## Step 5: Set Up Your Environment File

The environment file tells the app your secret keys (like your OpenAI API key). It is never shared or uploaded to GitHub.

Run this command:

```
cp .env.example .env
```

Now open the project in your code editor. In Cursor or VS Code, go to **File > Open Folder** and select the `CRM_Experimentation` folder on your Desktop.

Find the file called `.env` in the root of the project (not `.env.example`) and open it. You'll see something like this:

```
OPENAI_API_KEY="sk-..."
```

Replace `sk-...` with the actual OpenAI API key that Xinyu provides. Keep the quotes around it.

Save the file.

> **Important**: The only setting you truly need to change is `OPENAI_API_KEY`. Everything else works with the defaults for local development.

---

## Step 6: Set Up the Database

The app uses a local database file (no separate database server needed). Run these two commands:

```
npx prisma migrate dev
```

When it asks "Enter a name for the new migration", just press Enter to skip.

Then load the demo data:

```
npx prisma db seed
```

This creates sample companies, contacts, meetings, and nudges so you can explore the app right away.

---

## Step 7: Start the App

Run:

```
npm run dev
```

You should see something like:

```
▲ Next.js 16.1.6
- Local: http://localhost:3000
```

Open your web browser and go to:

**http://localhost:3000**

You'll see a login screen with a list of demo partners. Pick any name to sign in and explore.

---

## Everyday Usage

### Starting the app

Every time you want to use the app, open Terminal, navigate to the project folder, and start it:

```
cd ~/Desktop/CRM_Experimentation
npm run dev
```

Then open http://localhost:3000 in your browser.

### Stopping the app

In the Terminal window where the app is running, press **Ctrl + C** to stop it.

### Getting the latest updates

When Xinyu pushes new changes, you can pull them down:

```
cd ~/Desktop/CRM_Experimentation
git pull
npm install
npm run dev
```

The `npm install` step makes sure any new libraries are downloaded. It only takes a few seconds if nothing changed.

---

## Troubleshooting

**"Port 3000 is already in use"**
Something else is using port 3000. Either close that other app, or the system will automatically use port 3001 instead -- check the Terminal output for the URL.

**The app starts but pages look broken or empty**
You may need to re-seed the database:

```
npx prisma migrate dev
npx prisma db seed
```

**"OPENAI_API_KEY is not set" or AI features don't work**
Double-check that your `.env` file has the correct API key and that you saved the file. Then restart the app (Ctrl + C, then `npm run dev`).

**"npm install" fails with permission errors**
On Mac, try:

```
sudo npm install
```

It will ask for your computer password (the one you use to log in to your Mac).

**Something else is wrong**
Reach out to Xinyu with a screenshot of the error message in Terminal.

---

## What Each Part of the App Does

| Page | What it's for |
|------|---------------|
| **Dashboard** | Your home base -- shows today's top nudges, briefing, and recent activity |
| **Nudges** | Full list of AI-generated outreach suggestions with priority levels |
| **Contacts** | Browse and search all your contacts, view their history and signals |
| **Meetings** | See upcoming meetings with AI-generated prep briefs |
| **Chat** | Ask anything about your contacts, companies, or relationships |

---

## Quick Reference

| Task | Command |
|------|---------|
| Start the app | `npm run dev` |
| Stop the app | `Ctrl + C` |
| Get latest updates | `git pull && npm install` |
| Reset the database | `npx prisma migrate dev && npx prisma db seed` |
| Check Node.js version | `node -v` |
