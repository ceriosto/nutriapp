// ============================================================
//  NutriCalc Pro — app.js
//  Calculo nutricional clinico con gramaje por tiempo de comida
// ============================================================

// --- Meal percentage live update ---
document.querySelectorAll('.meal-pct').forEach(input => {
  input.addEventListener('input', updateMealTotal);
});

function updateMealTotal() {
  const inputs = document.querySelectorAll('.meal-pct');
  let total = 0;
  inputs.forEach(i => total += (parseFloat(i.value) || 0));
  const span = document.getElementById('meal-total');
  const status = document.getElementById('meal-total-status');
  span.textContent = total;
  if (Math.abs(total - 100) < 0.5) {
    status.textContent = '✔'; status.className = 'status-ok';
  } else {
    status.textContent = '✖ (debe ser 100)'; status.className = 'status-err';
  }
}

// ============================================================
//  MAIN CALCULATE
// ============================================================
function calculate() {
  // -- Read inputs --
  const name   = document.getElementById('patient-name').value.trim() || 'Paciente';
  const age    = parseFloat(document.getElementById('age').value);
  const sex    = document.getElementById('sex').value;
  const weight = parseFloat(document.getElementById('weight').value);
  const height = parseFloat(document.getElementById('height').value);
  const waist  = parseFloat(document.getElementById('waist').value) || null;
  const hip    = parseFloat(document.getElementById('hip').value) || null;
  const wrist  = parseFloat(document.getElementById('wrist').value) || null;
  const formula   = document.getElementById('formula').value;
  const activity  = parseFloat(document.getElementById('activity').value);
  const goal      = document.getElementById('goal').value;
  const dietType  = document.getElementById('diet-type').value;
  const clinical  = parseFloat(document.getElementById('clinical').value);
  const pathology = document.getElementById('pathology').value;

  // Validation
  if (!sex || !age || !weight || !height) {
    alert('Por favor completa: sexo, edad, peso y talla.');
    return;
  }

  // --- BMR ---
  let bmr = calcBMR(formula, sex, weight, height, age);
  let tdee = bmr * activity * clinical;

  // --- Goal adjustment ---
  const goalDelta = { maintain: 0, lose_mild: -250, lose: -500, lose_fast: -750, gain: 300 };
  let targetKcal = Math.round(tdee + (goalDelta[goal] || 0));
  if (targetKcal < 1000) targetKcal = 1000; // safety floor

  // --- Macro split ---
  const macroSplits = {
    'balanced':     { carb: 0.50, prot: 0.20, fat: 0.30 },
    'low-carb':     { carb: 0.30, prot: 0.35, fat: 0.35 },
    'high-protein': { carb: 0.45, prot: 0.30, fat: 0.25 },
    'mediterranean':{ carb: 0.55, prot: 0.20, fat: 0.25 },
  };
  const split = macroSplits[dietType] || macroSplits['balanced'];
  const carbKcal = targetKcal * split.carb;
  const protKcal = targetKcal * split.prot;
  const fatKcal  = targetKcal * split.fat;
  const carbG = Math.round(carbKcal / 4);
  const protG = Math.round(protKcal / 4);
  const fatG  = Math.round(fatKcal  / 9);

  // --- BMI ---
  const bmi = weight / ((height / 100) ** 2);
  const idealW = idealWeight(sex, height, wrist);
  let userIdealW = parseFloat(document.getElementById('ideal-weight').value) || idealW;

  // --- Meal distribution ---
  const mealIds = ['meal-breakfast','meal-snack-am','meal-lunch','meal-snack-pm','meal-dinner'];
  const mealNames = ['Desayuno','Colación AM','Almuerzo','Colación PM','Cena'];
  const mealIcons = ['🌅','🍎','☀️','🍊','🌙'];
  const meals = mealIds.map((id, i) => {
    const pct = parseFloat(document.getElementById(id).value) || 0;
    return {
      name: mealNames[i], icon: mealIcons[i], pct,
      kcal: Math.round(targetKcal * pct / 100),
      carbG: Math.round(carbG * pct / 100),
      protG: Math.round(protG * pct / 100),
      fatG:  Math.round(fatG  * pct / 100),
    };
  });

  // --- Micronutrients (DRI) ---
  const micros = getMicros(sex, age, pathology, weight);

  // --- Render ---
  renderPatientHeader(name, age, sex, weight, height);
  renderSummary(bmr, tdee, targetKcal, goal);
  renderBMI(bmi, userIdealW, waist, hip, sex, weight, height);
  renderMacros(carbG, protG, fatG, targetKcal, split);
  renderMeals(meals, carbG, protG, fatG);
  renderMicros(micros);
  renderClinicalNotes(pathology, clinical, goal, targetKcal, weight, sex);

  document.getElementById('results-section').style.display = 'block';
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
//  BMR FORMULAS
// ============================================================
function calcBMR(formula, sex, weight, height, age) {
  if (formula === 'mifflin') {
    return sex === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  } else if (formula === 'harris') {
    return sex === 'male'
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  } else { // WHO
    if (sex === 'male') {
      if (age < 3)  return 60.9 * weight - 54;
      if (age < 10) return 22.7 * weight + 495;
      if (age < 18) return 17.5 * weight + 651;
      if (age < 30) return 15.3 * weight + 679;
      if (age < 60) return 11.6 * weight + 879;
      return 13.5 * weight + 487;
    } else {
      if (age < 3)  return 61.0 * weight - 51;
      if (age < 10) return 22.5 * weight + 499;
      if (age < 18) return 12.2 * weight + 746;
      if (age < 30) return 14.7 * weight + 496;
      if (age < 60) return 8.7  * weight + 829;
      return 10.5 * weight + 596;
    }
  }
}

// ============================================================
//  IDEAL WEIGHT (Devine + Hamwi fallback)
// ============================================================
function idealWeight(sex, height, wrist) {
  const extra = (height - 152.4) / 2.54;
  if (sex === 'male') {
    const base = 50 + 2.3 * extra;
    if (wrist) {
      const frame = wrist < 17 ? 0.9 : wrist < 20 ? 1.0 : 1.1;
      return Math.round(base * frame * 10) / 10;
    }
    return Math.round(base * 10) / 10;
  } else {
    const base = 45.5 + 2.3 * extra;
    if (wrist) {
      const frame = wrist < 14 ? 0.9 : wrist < 16.5 ? 1.0 : 1.1;
      return Math.round(base * frame * 10) / 10;
    }
    return Math.round(base * 10) / 10;
  }
}

// ============================================================
//  MICRONUTRIENTS (DRI — IOM)
// ============================================================
function getMicros(sex, age, pathology, weight) {
  const isMale = sex === 'male';
  const isPreg = pathology === 'pregnancy';
  const isRenal = pathology === 'renal';

  return {
    'Vitaminas Liposolubles': [
      { name: 'Vitamina A', val: isMale ? '900 µg RAE' : isPreg ? '770 µg RAE' : '700 µg RAE' },
      { name: 'Vitamina D', val: age >= 70 ? '20 µg (800 UI)' : '15 µg (600 UI)' },
      { name: 'Vitamina E', val: '15 mg α-TE' },
      { name: 'Vitamina K', val: isMale ? '120 µg' : '90 µg' },
    ],
    'Vitaminas Hidrosolubles': [
      { name: 'Vitamina C', val: isMale ? '90 mg' : isPreg ? '85 mg' : '75 mg' },
      { name: 'Tiamina (B1)', val: isMale ? '1.2 mg' : '1.1 mg' },
      { name: 'Riboflavina (B2)', val: isMale ? '1.3 mg' : '1.1 mg' },
      { name: 'Niacina (B3)', val: isMale ? '16 mg NE' : '14 mg NE' },
      { name: 'Vitamina B6', val: age > 50 ? (isMale ? '1.7 mg' : '1.5 mg') : '1.3 mg' },
      { name: 'Ácido Fólico (B9)', val: isPreg ? '600 µg DFE' : '400 µg DFE' },
      { name: 'Vitamina B12', val: '2.4 µg' },
    ],
    'Macrominerales': [
      { name: 'Calcio', val: age >= 51 ? (isMale ? '1000 mg' : '1200 mg') : '1000 mg' },
      { name: 'Fósforo', val: isRenal ? '< 800 mg ⚠️' : '700 mg' },
      { name: 'Magnesio', val: isMale ? (age >= 31 ? '420 mg' : '400 mg') : (age >= 31 ? '320 mg' : '310 mg') },
      { name: 'Sodio', val: pathology === 'hypertension' ? '< 1500 mg ⚠️' : '< 2300 mg' },
      { name: 'Potasio', val: isRenal ? '< 2000 mg ⚠️' : (isMale ? '3400 mg' : '2600 mg') },
    ],
    'Microminerales': [
      { name: 'Hierro', val: isMale ? '8 mg' : (age < 51 ? '18 mg' : '8 mg') },
      { name: 'Zinc', val: isMale ? '11 mg' : '8 mg' },
      { name: 'Yodo', val: isPreg ? '220 µg' : '150 µg' },
      { name: 'Selenio', val: '55 µg' },
      { name: 'Cobre', val: '900 µg' },
      { name: 'Manganeso', val: isMale ? '2.3 mg' : '1.8 mg' },
    ],
    'Hidratación & Fibra': [
      { name: 'Agua total', val: isMale ? '3.7 L/día' : '2.7 L/día' },
      { name: 'Fibra dietética', val: isMale ? (age > 50 ? '30 g' : '38 g') : (age > 50 ? '21 g' : '25 g') },
      { name: 'Proteína (g/kg)', val: pathology === 'renal' ? '0.6–0.8 g/kg ⚠️' : `${(weight * 1.0).toFixed(0)}–${(weight * 1.2).toFixed(0)} g/día` },
    ],
  };
}

// ============================================================
//  RENDER FUNCTIONS
// ============================================================

function renderPatientHeader(name, age, sex, weight, height) {
  const el = document.getElementById('patient-header-card');
  const sexLabel = sex === 'male' ? '♂ Masculino' : '♀ Femenino';
  el.innerHTML = `
    <div class="patient-name-big">👤 ${name}</div>
    <span class="patient-meta-item">${age} años</span>
    <span class="patient-meta-item">${sexLabel}</span>
    <span class="patient-meta-item">⚖️ ${weight} kg</span>
    <span class="patient-meta-item">📏 ${height} cm</span>
    <span class="patient-meta-item">📅 ${new Date().toLocaleDateString('es', {year:'numeric',month:'long',day:'numeric'})}</span>
  `;
}

function renderSummary(bmr, tdee, targetKcal, goal) {
  const goalLabels = {
    maintain:'Mantenimiento', lose_mild:'Pérdida leve',
    lose:'Pérdida de peso', lose_fast:'Pérdida agresiva', gain:'Ganancia muscular'
  };
  document.getElementById('summary-cards').innerHTML = `
    <div class="summary-card blue">
      <span class="card-icon">🔥</span>
      <div class="card-label">TMB (Metabolismo Basal)</div>
      <div class="card-value blue">${Math.round(bmr)}</div>
      <div class="card-unit">kcal/día</div>
    </div>
    <div class="summary-card green">
      <span class="card-icon">⚡</span>
      <div class="card-label">TDEE (Gasto Total)</div>
      <div class="card-value green">${Math.round(tdee)}</div>
      <div class="card-unit">kcal/día</div>
    </div>
    <div class="summary-card orange">
      <span class="card-icon">🎯</span>
      <div class="card-label">Meta: ${goalLabels[goal]}</div>
      <div class="card-value orange">${targetKcal}</div>
      <div class="card-unit">kcal/día objetivo</div>
    </div>
  `;
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Bajo peso', color: '#38bdf8' };
  if (bmi < 25)   return { label: 'Normopeso', color: '#34d399' };
  if (bmi < 30)   return { label: 'Sobrepeso', color: '#facc15' };
  if (bmi < 35)   return { label: 'Obesidad I', color: '#fb923c' };
  if (bmi < 40)   return { label: 'Obesidad II', color: '#f87171' };
  return { label: 'Obesidad III', color: '#dc2626' };
}

function renderBMI(bmi, idealW, waist, hip, sex, weight, height) {
  const cat = bmiCategory(bmi);
  // Needle: BMI 15–45 mapped to 0–100%
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / 30) * 100));
  const icc = (waist && hip) ? (waist / hip).toFixed(2) : null;
  const iccRisk = icc
    ? (sex === 'male' ? (icc > 0.95 ? '⚠️ Riesgo' : '✔ Normal') : (icc > 0.85 ? '⚠️ Riesgo' : '✔ Normal'))
    : '—';
  const pctIdeal = Math.round((weight / idealW) * 100);

  document.getElementById('bmi-card').innerHTML = `
    <div class="bmi-value-wrap">
      <div class="bmi-big" style="color:${cat.color}">${bmi.toFixed(1)}</div>
      <div class="bmi-label">IMC (kg/m²)</div>
      <div class="bmi-classification" style="color:${cat.color}">${cat.label}</div>
    </div>
    <div class="bmi-bar-wrap">
      <div class="bmi-bar-track">
        <div class="bmi-needle" style="left:${pct}%"></div>
      </div>
      <div class="bmi-scale-labels">
        <span>&lt;18.5</span><span>18.5</span><span>25</span><span>30</span><span>35</span><span>40+</span>
      </div>
    </div>
    <div class="bmi-other-info">
      <div class="bmi-info-item">
        <div class="bmi-info-label">Peso Ideal (Devine)</div>
        <div class="bmi-info-val">${idealW} kg</div>
      </div>
      <div class="bmi-info-item">
        <div class="bmi-info-label">% Peso Ideal</div>
        <div class="bmi-info-val">${pctIdeal}%</div>
      </div>
      <div class="bmi-info-item">
        <div class="bmi-info-label">ICC (Cintura/Cadera)</div>
        <div class="bmi-info-val">${icc ? `${icc} ${iccRisk}` : 'Sin datos'}</div>
      </div>
    </div>
  `;
}

function renderMacros(carbG, protG, fatG, totalKcal, split) {
  const cPct = Math.round(split.carb * 100);
  const pPct = Math.round(split.prot * 100);
  const fPct = Math.round(split.fat  * 100);
  document.getElementById('macro-grid').innerHTML = `
    <div class="macro-card carb">
      <div class="macro-name">🍞 Carbohidratos</div>
      <div class="macro-grams carb">${carbG}<span style="font-size:1rem"> g</span></div>
      <div class="macro-kcal">${Math.round(carbG * 4)} kcal · 4 kcal/g</div>
      <div class="macro-pct" style="color:var(--accent)">${cPct}% del total</div>
    </div>
    <div class="macro-card prot">
      <div class="macro-name">🥩 Proteínas</div>
      <div class="macro-grams prot">${protG}<span style="font-size:1rem"> g</span></div>
      <div class="macro-kcal">${Math.round(protG * 4)} kcal · 4 kcal/g</div>
      <div class="macro-pct" style="color:var(--accent3)">${pPct}% del total</div>
    </div>
    <div class="macro-card fat">
      <div class="macro-name">🥑 Grasas</div>
      <div class="macro-grams fat">${fatG}<span style="font-size:1rem"> g</span></div>
      <div class="macro-kcal">${Math.round(fatG * 9)} kcal · 9 kcal/g</div>
      <div class="macro-pct" style="color:var(--accent4)">${fPct}% del total</div>
    </div>
  `;
  document.getElementById('macro-bar').innerHTML = `
    <div class="bar-segment bar-carb" style="width:${cPct}%" title="Carbohidratos ${cPct}%"></div>
    <div class="bar-segment bar-prot" style="width:${pPct}%" title="Proteínas ${pPct}%"></div>
    <div class="bar-segment bar-fat"  style="width:${fPct}%" title="Grasas ${fPct}%"></div>
  `;
}

function renderMeals(meals, totalC, totalP, totalF) {
  document.getElementById('meals-grid').innerHTML = meals.map(m => {
    const cPct = totalC ? Math.round((m.carbG / totalC) * 100) : 0;
    const pPct = totalP ? Math.round((m.protG / totalP) * 100) : 0;
    const fPct = totalF ? Math.round((m.fatG  / totalF) * 100) : 0;
    return `
      <div class="meal-card">
        <div class="meal-card-header">
          <span class="meal-card-icon">${m.icon}</span>
          <span class="meal-card-name">${m.name}</span>
          <span class="meal-card-pct">${m.pct}%</span>
        </div>
        <div class="meal-kcal">${m.kcal}</div>
        <div class="meal-kcal-label">kcal</div>
        <div class="meal-macros">
          <div>
            <div class="meal-macro-row">
              <span class="meal-macro-name">🍞 Carbohidratos</span>
              <span class="meal-macro-val c">${m.carbG} g</span>
            </div>
            <div class="meal-mini-bar"><div class="meal-mini-fill fill-c" style="width:${cPct}%"></div></div>
          </div>
          <div>
            <div class="meal-macro-row">
              <span class="meal-macro-name">🥩 Proteínas</span>
              <span class="meal-macro-val p">${m.protG} g</span>
            </div>
            <div class="meal-mini-bar"><div class="meal-mini-fill fill-p" style="width:${pPct}%"></div></div>
          </div>
          <div>
            <div class="meal-macro-row">
              <span class="meal-macro-name">🥑 Grasas</span>
              <span class="meal-macro-val f">${m.fatG} g</span>
            </div>
            <div class="meal-mini-bar"><div class="meal-mini-fill fill-f" style="width:${fPct}%"></div></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderMicros(micros) {
  document.getElementById('micro-grid').innerHTML = Object.entries(micros).map(([cat, items]) => `
    <div class="micro-category">
      <div class="micro-cat-title">${cat}</div>
      ${items.map(i => `
        <div class="micro-item">
          <span class="micro-item-name">${i.name}</span>
          <span class="micro-item-val">${i.val}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderClinicalNotes(pathology, clinical, goal, targetKcal, weight, sex) {
  const notes = [];
  if (clinical > 1.0) notes.push(`Factor de estrés aplicado (×${clinical}). Reevaluar semanalmente.`);
  if (pathology === 'diabetes') {
    notes.push('Diabetes tipo 2: limitar azúcares simples, preferir carbohidratos complejos con bajo índice glucémico.');
    notes.push('Distribuir carbohidratos uniformemente en los tiempos de comida para evitar picos de glucosa.');
  }
  if (pathology === 'hypertension') {
    notes.push('Hipertensión: restringir sodio a < 1500 mg/día. Priorizar alimentos ricos en potasio y magnesio.');
    notes.push('Dieta DASH recomendada: frutas, verduras, lácteos bajos en grasa, granos enteros.');
  }
  if (pathology === 'renal') {
    notes.push('ERC: restricción de fósforo (< 800 mg/día), potasio (< 2000 mg/día) y proteínas (0.6–0.8 g/kg).');
    notes.push('Evitar alimentos procesados con aditivos de fósforo (absorción ~100%).');
  }
  if (pathology === 'obesity') {
    notes.push(`Obesidad: déficit calórico aplicado. Meta: pérdida de 0.5–1 kg/semana.`);
    notes.push('Priorizar proteínas para preservar masa muscular durante la pérdida de peso.');
  }
  if (pathology === 'pregnancy') {
    notes.push('Embarazo: incremento de ácido fólico (600 µg/día), hierro (27 mg/día) y calcio (1000 mg/día).');
    notes.push('Evitar déficit calórico severo. Revaluar cada trimestre.');
  }
  notes.push(`Requerimiento hídrico estimado: ${Math.round(weight * 35)} mL/día (35 mL/kg).`);
  notes.push('Estos valores son orientativos. Ajustar según evolución clínica y preferencias del paciente.');

  document.getElementById('clinical-notes').innerHTML = `
    <h4>⚠️ Notas Clínicas y Recomendaciones</h4>
    <ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>
  `;
}

// ============================================================
//  RECALCULATE
// ============================================================
function recalculate() {
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
}

// Init meal total display
updateMealTotal();
