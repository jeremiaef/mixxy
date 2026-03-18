---
created: 2026-03-18T08:30:42.532Z
title: Behavioral intelligence monthly spend prediction
area: general
files: []
---

## Problem

Users want to know not just what they spent, but what they should *prepare* next month based on their own habits. After 30+ days of logged expenses, Mixxy has enough data to predict next month's spend per category — but currently only shows historical summaries with no forward-looking guidance.

Inspired by Cleo's expense forecasting feature. Unlike Cleo (which reads bank data), Mixxy works from manually logged expenses in Bahasa Indonesia — making the prediction intentional and privacy-friendly.

## Solution

New command (`/prediksi` or `/analisis`) that:
1. Requires ≥30 days of expense history to activate
2. Uses Claude to classify each category as fixed (rent, subscriptions) vs. variable (food, entertainment)
3. Calculates average monthly spend per category over available history
4. Generates a forward-looking recommendation: "Bulan depan, siapkan sekitar Rp X. Kamu bisa hemat Rp Y di kategori Z tanpa banyak berubah."
5. Optionally suggests a realistic savings target based on discretionary spend variance

Build as v1.1 milestone — this is the "intelligence" layer on top of the v1.0 tracking foundation.
