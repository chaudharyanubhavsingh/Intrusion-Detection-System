# 🛡️ Real-Time AI-Powered Intrusion Detection & Prevention System (IDS)

A full-stack, real-time Intrusion Detection and Prevention System that monitors network traffic, detects suspicious behavior using AI/ML, and automatically blocks malicious IPs using Docker-controlled firewall rules.

---
![WhatsApp Image 2025-04-30 at 23 01 45_8926fab2](https://github.com/user-attachments/assets/4ee63c0f-57b4-4fbc-9e09-ba1c07669b6b)
![WhatsApp Image 2025-04-30 at 23 02 58_c8b56470](https://github.com/user-attachments/assets/f5be1b82-3663-4cf2-afd3-21f306fe2e8e)
![WhatsApp Image 2025-04-30 at 23 00 53_15bcc0ee](https://github.com/user-attachments/assets/87012097-0986-4850-84fb-d92f56fc38b6)


## 📌 Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Screenshots](#screenshots)
- [Model Training & Dataset](#model-training--dataset)
- [How it Works](#how-it-works)
- [Contributors](#contributors)

---

## 🔍 Overview
This project integrates real-time network monitoring with AI-powered classification to identify cyber threats like:
- DDoS Attacks
- Port Scans
- Brute Force Attacks
- ICMP Floods

It combines FastAPI, React, WebSockets, and XGBoost to:
- Detect threats
- Display them on a dashboard
- Block malicious IPs automatically via iptables inside a Docker firewall container

---

## 🚀 Tech Stack

### Frontend:
- React.js
- Zustand (Global State Management)
- Tailwind CSS
- WebSockets (Live Data Updates)

### Backend:
- FastAPI (Python)
- asyncio
- Scapy (Packet Sniffing)
- psutil (System Stats)

### Machine Learning:
- XGBoost Classifier
- SMOTE for class balancing
- SHAP (Model Explainability)
- Flask (ML API Server)

### Data:
- NSL-KDD & CIC-IDS2017
- Real-time packet data

### DevOps / Security:
- Docker (Firewall Container)
- iptables
- Ngrok (Secure API Tunneling)
- Redis (optional for caching)
- MongoDB (optional for log storage)

### Notifications:
- Twilio (SMS Alerts)
- Nodemailer (Email Alerts)

---

## 🔧 Features

✅ Real-time threat monitoring using Scapy
✅ XGBoost AI model for anomaly-based detection
✅ Dynamic dashboard for logs, stats, and firewall control
✅ Auto-block/unblock IPs via WebSocket
✅ Circular visualizations for threat analysis
✅ Email & SMS alerts on critical events
✅ Secure 30-day rotating logs
✅ Visual ML explainability (SHAP, bar graphs)

---

## 🧠 Architecture

```
Packets ➡️ Scapy (FastAPI) ➡️ Feature Extraction ➡️ ML API (Flask/XGBoost)
       ↘ Threat Identified ➡ Update Threat List ➡ Dashboard (WebSocket)
                                       ↘ Block IP via Docker ➡ iptables
```

---

## ⚙️ Installation

1. Clone the repo:
```bash
git clone https://github.com/your-username/real-time-ids.git
cd real-time-ids
```

2. Setup Python backend:
```bash
cd backend
pip install -r requirements.txt
python main.py
```

3. Start the ML API server:
```bash
cd ml_model
python app.py
```

4. Start frontend:
```bash
cd frontend
npm install
npm run dev
```

5. Start Docker firewall container:
```bash
docker run -it --name demo_firewall --net=host --privileged ubuntu /bin/bash
```

---

## 🖼️ Screenshots

> Add dashboard screenshots, circular bar chart, threat logs, etc.

---

## 📊 Model Training & Dataset
- Used NSL-KDD and CIC-IDS2017 datasets.
- Preprocessing: Null handling, normalization (MinMaxScaler), SMOTE oversampling.
- Model: XGBoostClassifier with GridSearchCV tuning.
- Accuracy: 96%, F1-score: 93%, False Positives: < 3%.

---

## 🔄 How It Works

1. Scapy monitors network packets targeting the local machine.
2. Features are extracted like packet rate, port count, SYN flags, ICMP counts.
3. Features sent to ML API via Flask/ngrok.
4. Prediction is returned: 0 = Safe, 1 = Threat.
5. If threat:
   - Dashboard updates live
   - IP auto-blocked via iptables
   - Alerts sent to admin
6. Users can unblock IPs manually or analyze logs.

---

## 👨‍💻 Contributors

Made with ❤️ by Anubhav Chaudhary

---

Feel free to fork and modify for university, enterprise, or IoT security deployments.

🛠️ Secure. Smart. Scalable.
