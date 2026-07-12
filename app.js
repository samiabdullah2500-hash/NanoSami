/**
 * NanoSami material reference peak sets for rule-based FTIR matching.
 * Peaks are typical literature positions (cm⁻¹). essential:true peaks carry
 * double weight in the similarity score. Positions vary with grade, phase,
 * crystallinity, and sample preparation — matching is preliminary only.
 */
export default [
  { name: 'Polystyrene (PS)', formula: '(C₈H₈)ₙ', class: 'polymer', peaks: [
    { wavenumber: 3025, label: 'aromatic C–H stretch', essential: true },
    { wavenumber: 2920, label: 'CH₂ asym. stretch', essential: false },
    { wavenumber: 1600, label: 'aromatic C=C', essential: true },
    { wavenumber: 1493, label: 'ring stretch', essential: true },
    { wavenumber: 1452, label: 'ring/CH₂ bend', essential: false },
    { wavenumber: 756, label: 'Ar C–H oop bend', essential: true },
    { wavenumber: 698, label: 'ring oop bend', essential: true },
  ]},
  { name: 'Polyethylene (PE)', formula: '(C₂H₄)ₙ', class: 'polymer', peaks: [
    { wavenumber: 2915, label: 'CH₂ asym. stretch', essential: true },
    { wavenumber: 2848, label: 'CH₂ sym. stretch', essential: true },
    { wavenumber: 1465, label: 'CH₂ scissoring', essential: true },
    { wavenumber: 730, label: 'CH₂ rocking (doublet)', essential: false },
    { wavenumber: 719, label: 'CH₂ rocking (doublet)', essential: true },
  ]},
  { name: 'Polypropylene (PP)', formula: '(C₃H₆)ₙ', class: 'polymer', peaks: [
    { wavenumber: 2950, label: 'CH₃ asym. stretch', essential: true },
    { wavenumber: 2917, label: 'CH₂ asym. stretch', essential: false },
    { wavenumber: 2838, label: 'CH₂ sym. stretch', essential: false },
    { wavenumber: 1455, label: 'CH₂/CH₃ bend', essential: true },
    { wavenumber: 1376, label: 'CH₃ umbrella', essential: true },
    { wavenumber: 997, label: 'isotactic helix band', essential: false },
    { wavenumber: 972, label: 'chain band', essential: true },
  ]},
  { name: 'PET (polyethylene terephthalate)', formula: '(C₁₀H₈O₄)ₙ', class: 'polymer', peaks: [
    { wavenumber: 1715, label: 'ester C=O stretch', essential: true },
    { wavenumber: 1240, label: 'C–O–C asym. stretch', essential: true },
    { wavenumber: 1095, label: 'C–O stretch', essential: true },
    { wavenumber: 1408, label: 'ring in-plane', essential: false },
    { wavenumber: 872, label: 'ring C–H oop', essential: false },
    { wavenumber: 727, label: 'ring oop bend', essential: true },
  ]},
  { name: 'PVC (polyvinyl chloride)', formula: '(C₂H₃Cl)ₙ', class: 'polymer', peaks: [
    { wavenumber: 2912, label: 'C–H stretch', essential: false },
    { wavenumber: 1427, label: 'CH₂ bend', essential: true },
    { wavenumber: 1255, label: 'C–H bend (CHCl)', essential: true },
    { wavenumber: 960, label: 'trans C–H wag', essential: false },
    { wavenumber: 690, label: 'C–Cl stretch', essential: true },
    { wavenumber: 615, label: 'C–Cl stretch', essential: true },
  ]},
  { name: 'PMMA (poly(methyl methacrylate))', formula: '(C₅H₈O₂)ₙ', class: 'polymer', peaks: [
    { wavenumber: 2995, label: 'CH₃ stretch', essential: false },
    { wavenumber: 2950, label: 'C–H stretch', essential: false },
    { wavenumber: 1730, label: 'ester C=O stretch', essential: true },
    { wavenumber: 1435, label: 'O–CH₃ bend', essential: true },
    { wavenumber: 1240, label: 'C–O–C stretch', essential: true },
    { wavenumber: 1145, label: 'C–O–C stretch', essential: true },
    { wavenumber: 750, label: 'skeletal', essential: false },
  ]},
  { name: 'ZnO (zinc oxide)', formula: 'ZnO', class: 'metal oxide', peaks: [
    { wavenumber: 450, label: 'Zn–O lattice stretch', essential: true },
    { wavenumber: 3430, label: 'surface O–H (environmental)', essential: false, common: true },
    { wavenumber: 1630, label: 'adsorbed H₂O bend (environmental)', essential: false, common: true },
    { wavenumber: 1420, label: 'surface carbonate (environmental impurity)', essential: false, common: true },
  ]},
  { name: 'TiO₂ (titanium dioxide)', formula: 'TiO₂', class: 'metal oxide', peaks: [
    { wavenumber: 650, label: 'Ti–O–Ti broad envelope', essential: true },
    { wavenumber: 500, label: 'Ti–O stretch', essential: true },
    { wavenumber: 3400, label: 'surface O–H (environmental)', essential: false, common: true },
    { wavenumber: 1630, label: 'adsorbed H₂O bend (environmental)', essential: false, common: true },
  ]},
  { name: 'SiO₂ (silica)', formula: 'SiO₂', class: 'oxide', peaks: [
    { wavenumber: 1090, label: 'Si–O–Si asym. stretch', essential: true },
    { wavenumber: 800, label: 'Si–O–Si sym. stretch', essential: true },
    { wavenumber: 465, label: 'Si–O–Si rocking', essential: true },
    { wavenumber: 960, label: 'Si–OH stretch', essential: false },
    { wavenumber: 3430, label: 'surface O–H (environmental)', essential: false, common: true },
  ]},
  { name: 'Fe₂O₃ (hematite, α)', formula: 'α-Fe₂O₃', class: 'metal oxide', peaks: [
    { wavenumber: 540, label: 'Fe–O stretch', essential: true },
    { wavenumber: 470, label: 'Fe–O stretch', essential: true },
    { wavenumber: 3400, label: 'surface O–H (environmental)', essential: false, common: true },
    { wavenumber: 1630, label: 'adsorbed H₂O bend (environmental)', essential: false, common: true },
  ]},
  { name: 'Fe₃O₄ (magnetite)', formula: 'Fe₃O₄', class: 'metal oxide', peaks: [
    { wavenumber: 570, label: 'Fe–O stretch (tetrahedral)', essential: true },
    { wavenumber: 390, label: 'Fe–O stretch (octahedral, often below range)', essential: false },
    { wavenumber: 3400, label: 'surface O–H (environmental)', essential: false, common: true },
    { wavenumber: 1630, label: 'adsorbed H₂O bend (environmental)', essential: false, common: true },
  ]},
  { name: 'g-C₃N₄ (graphitic carbon nitride)', formula: 'g-C₃N₄', class: '2D / polymeric semiconductor', peaks: [
    { wavenumber: 810, label: 'heptazine ring breathing', essential: true },
    { wavenumber: 1240, label: 'aromatic C–N stretch', essential: true },
    { wavenumber: 1320, label: 'C–N(–C) stretch', essential: true },
    { wavenumber: 1410, label: 'aromatic C–N heterocycle', essential: false },
    { wavenumber: 1570, label: 'C=N stretch', essential: false },
    { wavenumber: 1635, label: 'C=N stretch', essential: true },
    { wavenumber: 3200, label: 'N–H stretch (broad)', essential: false },
  ]},
];
