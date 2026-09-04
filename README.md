# 🚨 Fraud Spike Detector

A small project I built to explore how fraud spikes can be detected from transaction data and presented in a way that is actually useful for someone monitoring a payment system.

## Why I built this

Fraud detection is usually talked about as **"is this transaction fraudulent or not?"**

But I found another interesting problem:

**What happens when fraudulent activity suddenly starts increasing?**

For example, a payment system might normally have a small amount of suspicious activity. Then, within a few minutes, the number of suspicious transactions suddenly goes up.

Instead of looking at thousands of transactions one by one, I wanted to build something that could help identify that spike and make it easier to investigate.

That's what this project is about.

---

## What it does

The dashboard looks at transaction activity and highlights unusual patterns such as:

* Sudden increases in transaction volume
* Unusual transaction velocity
* Changes in fraud rate
* Suspicious user behaviour
* Potential fraud spikes
* High-risk cases that may need investigation

The idea is pretty simple:

```text
Transaction Data
       ↓
Analyze Activity
       ↓
Find Unusual Patterns
       ↓
Calculate Risk
       ↓
Show Potential Fraud
```

---

## Dashboard

The project has a dashboard where you can get a quick overview of what's happening.

It includes things like:

* Overall transaction activity
* Fraud rate
* Risk level
* Fraud spike indicators
* Suspicious cases
* Cost/risk analysis

I also added an investigation panel so the user doesn't just get an alert, but can actually look at **why the activity was considered suspicious**.

---

## A simple example

Imagine a merchant normally receives around 10,000 transactions every hour.

Then suddenly:

```text
Transaction volume   ↑ 42%
Failed payments      ↑ 67%
Suspicious users     ↑ 31%
Fraud rate           ↑ 185%
```

Looking at each transaction individually might not immediately show the bigger picture.

But when these things happen together, it could be a sign that something unusual is going on.

The goal of this project is to make that kind of change easier to notice.

---

## Tech I used

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Recharts**
* **Vercel**

I chose Next.js because I wanted to build both the interface and API side of the project in the same application.

---

## Project structure

```text
app/
├── api/
│   └── narrate/
│       └── route.ts
├── globals.css
├── layout.tsx
└── page.tsx

components/
└── fraud/
    ├── badges.tsx
    ├── case-panel.tsx
    ├── console.tsx
    └── cost-curve.tsx
```

---

## Running it locally

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
```

Go into the project:

```bash
cd YOUR_REPOSITORY
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 🌐 Live Demo

You can try the deployed version here:

**YOUR_VERCEL_URL**

---

## What I learned

This project helped me understand a few things that I wouldn't have really understood by just following tutorials:

* How to structure a Next.js application
* Building reusable React components
* Working with transaction/fraud data
* Presenting data through charts
* Thinking about fraud from an operational perspective
* Creating API routes
* Deploying a full-stack application with Vercel

The biggest thing I learned is that detecting fraud isn't only about getting a prediction. **How you present that prediction and help someone investigate it matters too.**

---

## What's next?

There are quite a few things I'd like to add if I continue working on it:
fggyuuuutTH
* Connect it to a real transaction dataset
* Add a proper database
* Improve the anomaly detection logic
* Add real-time transaction simulation
* Add authentication
* Add more detailed fraud investigation
* Improve the AI-generated explanations
* Add automated alerts

For now, this is a working prototype and a project I'm using to learn more about fraud detection and full-stack development.

---

## ⭐ If you found it interesting

Feel free to check out the code, try the demo, or leave a star on the repository.

Thanks for checking it out!
