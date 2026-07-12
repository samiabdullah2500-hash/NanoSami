# NanoSami — Data provenance

NanoSami's reference datasets are compiled from standard, widely used sources.
No DOIs or article-level citations are fabricated; where a value could not be
traced to an authoritative source it is marked in the dataset itself as variable
or requiring verification.

## FTIR band dictionary and material fingerprints
Typical group-frequency ranges follow standard IR correlation references:
- G. Socrates, *Infrared and Raman Characteristic Group Frequencies*, 3rd ed., Wiley.
- Silverstein, Webster & Kiemle, *Spectrometric Identification of Organic Compounds*, Wiley.
- NIST Chemistry WebBook (webbook.nist.gov) for representative compound spectra.
Polymer fingerprint positions (PS, PE, PP, PET, PVC, PMMA) follow the ranges
commonly used in FTIR-based polymer/microplastic identification literature.
Band positions in real samples shift with crystallinity, phase and preparation;
the dictionary stores ranges, not single certified values.

## XRD
- Bragg and Scherrer equations: standard forms as in Cullity & Stock,
  *Elements of X-Ray Diffraction*, and Langford & Wilson, J. Appl. Cryst. 11 (1978)
  102–113 (Scherrer constant discussion).
- Quoted reflections (e.g. ZnO wurtzite ≈31.8/34.4/36.3° 2θ, Cu Kα; anatase (101)
  ≈25.3°) correspond to widely reproduced powder-diffraction data (JCPDS/ICDD
  card 36-1451 for ZnO). ICDD card data themselves are licensed and are therefore
  referenced, not reproduced.

## Nanomaterials library
Band gaps, structures and properties are typical textbook/review ranges; entries
state explicitly when a value is phase-, size-, termination- or synthesis-dependent
(e.g. Fe₃O₄ gap, MXene terminations, GO stoichiometry). Verify against primary
literature for any specific system before publication use.

## Constants
X-ray wavelengths (Cu Kα1 1.5406 Å etc.) follow standard tabulated values
(International Tables for Crystallography, Vol. C).
