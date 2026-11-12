# Checks: Merino Court

0 fail · 24 warn · 1 known · 1 changes · 184 pass (baseline main)

Basis: *independent* = measured against sources the model wasn't built from; *user rule* = a rule you set; *derived* = partly measured against the model's own assumptions.

## frames

| status | check | basis | detail |
|---|---|---|---|
| PASS | traces made from this building file | derived | trace.json matches |
| PASS | the key plan's block outline matches OpenStreetMap's footprint | independent | 7 corners, 0.45 m rms, worst 0.73 m (wing, Lever St face, page-down end); 8.14 px/m; up the page is 80.5° true |
| PASS | Lower Ground Floor key plan registered on the sheet | independent | site outlines 0.64 px apart on average (allowed 1.5) |
| PASS | Ground Floor key plan registered on the sheet | independent | site outlines 0.30 px apart on average (allowed 1.5) |
| PASS | Mezzanine Floor key plan registered on the sheet | independent | site outlines 0.28 px apart on average (allowed 1.5) |
| PASS | Second Floor key plan registered on the sheet | independent | site outlines 0.23 px apart on average (allowed 1.5) |
| PASS | Third Floor key plan registered on the sheet | independent | site outlines 0.49 px apart on average (allowed 1.5) |
| PASS | Fourth Floor key plan registered on the sheet | independent | site outlines 0.97 px apart on average (allowed 1.5) |
| PASS | every unit floor has its own cell on its key plan | independent |  |
| PASS | the block's roof is where the levels put it | independent | LiDAR roof 18.13 m above the street, levels' top 18.00 m (+0.13 m) |

## geometry

| status | check | basis | detail |
|---|---|---|---|
| PASS | outlines are valid polygons | independent |  |
| PASS | unit floors drawn by hand (trace.manual, each for a rule) | derived | none |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | M2 on the mezzanine floor: 4.2 px |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | M3 on the mezzanine floor: 5.0 px |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | H1 on the mezzanine floor: 5.4 px |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | H1 on the first floor: 5.0 px |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | MZ4 on the mezzanine floor: 4.4 px |
| WARN | units straightened within 4 px (0.5 m) of their trace | derived | F7 on the second floor: 4.0 px |
| PASS | no units overlap | independent |  |
| PASS | neighbours share their walls (no gap under 0.5 m) | derived |  |
| PASS | every unit is on the site | independent |  |
| PASS | every upper floor stands on the floor below | derived |  |

## areas and plans

| status | check | basis | detail |
|---|---|---|---|
| WARN | each unit's key-plan area matches the brochure's gross area | independent | LW1: 249.0 m² drawn (to the walls' centre lines) for 262.53 m² printed (0.95; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | LW2: 295.2 m² drawn (to the walls' centre lines) for 251.66 m² printed (1.17; allowed 0.95-1.20) |
| WARN | each unit's key-plan area matches the brochure's gross area | independent | M1: 101.7 m² drawn (to the walls' centre lines) for 80.82 m² printed (1.26; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | M2: 92.1 m² drawn (to the walls' centre lines) for 78.96 m² printed (1.17; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | M3: 59.0 m² drawn (to the walls' centre lines) for 51.28 m² printed (1.15; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | H1: 166.8 m² drawn (to the walls' centre lines) for 148.36 m² printed (1.12; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | MZ1: 93.8 m² drawn (to the walls' centre lines) for 87.51 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | MZ2: 50.9 m² drawn (to the walls' centre lines) for 48.02 m² printed (1.06; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | MZ3: 57.9 m² drawn (to the walls' centre lines) for 54.25 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | MZ4: 89.8 m² drawn (to the walls' centre lines) for 86.39 m² printed (1.04; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F1: 93.8 m² drawn (to the walls' centre lines) for 87.97 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F2: 50.9 m² drawn (to the walls' centre lines) for 48.21 m² printed (1.06; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F3: 57.3 m² drawn (to the walls' centre lines) for 54.53 m² printed (1.05; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F4: 87.6 m² drawn (to the walls' centre lines) for 86.11 m² printed (1.02; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F5: 93.8 m² drawn (to the walls' centre lines) for 87.97 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F6: 50.9 m² drawn (to the walls' centre lines) for 48.21 m² printed (1.06; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F7: 58.1 m² drawn (to the walls' centre lines) for 54.53 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F8: 90.1 m² drawn (to the walls' centre lines) for 86.39 m² printed (1.04; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F9: 161.0 m² drawn (to the walls' centre lines) for 146.31 m² printed (1.10; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F10: 97.8 m² drawn (to the walls' centre lines) for 91.78 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F11: 104.6 m² drawn (to the walls' centre lines) for 98.0 m² printed (1.07; allowed 0.95-1.20) |
| PASS | each unit's key-plan area matches the brochure's gross area | independent | F12: 150.9 m² drawn (to the walls' centre lines) for 142.22 m² printed (1.06; allowed 0.95-1.20) |
| PASS | each floor's plan fits its key-plan cell | independent | LW1@-1 (LW1 lower ground): overlap IoU 0.87, plan 157.2 m² / cell 138.4 m² (1.14); scale 15.18 mm/px, tilt +0.05° |
| PASS | each floor's plan fits its key-plan cell | independent | LW1@0 (LW1 ground): overlap IoU 0.89, plan 124.3 m² / cell 110.6 m² (1.12); scale 15.18 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | LW2@-1 (LW2 lower ground): overlap IoU 0.91, plan 146.0 m² / cell 157.5 m² (0.93); scale 13.35 mm/px, tilt -0.16° |
| PASS | each floor's plan fits its key-plan cell | independent | LW2@0 (LW2 ground): overlap IoU 0.87, plan 120.4 m² / cell 137.8 m² (0.87); scale 13.35 mm/px, tilt -0.20° |
| PASS | each floor's plan fits its key-plan cell | independent | M1@0 (M1 ground): overlap IoU 0.86, plan 44.0 m² / cell 50.9 m² (0.86); scale 12.00 mm/px, tilt +0.20° |
| PASS | each floor's plan fits its key-plan cell | independent | M1@1 (M1 upper): overlap IoU 0.88, plan 44.7 m² / cell 50.9 m² (0.88); scale 12.00 mm/px, tilt -0.86° |
| PASS | each floor's plan fits its key-plan cell | independent | M2@0 (M2 ground): overlap IoU 0.95, plan 43.9 m² / cell 46.0 m² (0.95); scale 12.96 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | M2@1 (M2 upper): overlap IoU 0.94, plan 43.3 m² / cell 46.0 m² (0.94); scale 12.96 mm/px, tilt -0.21° |
| PASS | each floor's plan fits its key-plan cell | independent | M3@0 (M3 ground): overlap IoU 0.92, plan 37.4 m² / cell 40.2 m² (0.93); scale 12.91 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | M3@1 (M3 upper): overlap IoU 0.86, plan 19.4 m² / cell 18.8 m² (1.03); scale 12.91 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | H1@1 (H1 ground): overlap IoU 0.89, plan 45.8 m² / cell 43.1 m² (1.06); scale 11.24 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | H1@2 (H1 first): overlap IoU 0.92, plan 41.4 m² / cell 43.1 m² (0.96); scale 11.24 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | H1@3 (H1 second): overlap IoU 0.95, plan 42.0 m² / cell 43.1 m² (0.97); scale 11.24 mm/px, tilt -0.11° |
| PASS | each floor's plan fits its key-plan cell | independent | H1@4 (H1 third): overlap IoU 0.86, plan 32.3 m² / cell 37.5 m² (0.86); scale 11.24 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | MZ1@1 (MZ1/F1/F5): overlap IoU 0.95, plan 92.5 m² / cell 93.8 m² (0.99); scale 14.07 mm/px, tilt +0.00° |
| WARN | each floor's plan fits its key-plan cell | independent | MZ2@1 (MZ2/F2/F6): overlap IoU 0.76, plan 53.5 m² / cell 50.9 m² (1.05); scale 15.53 mm/px, tilt -0.27° |
| PASS | each floor's plan fits its key-plan cell | independent | MZ3@1 (MZ3/F3/F7): overlap IoU 0.92, plan 58.9 m² / cell 57.9 m² (1.02); scale 12.19 mm/px, tilt -0.22° |
| PASS | each floor's plan fits its key-plan cell | independent | MZ4@1 (MZ4/F4/F8): overlap IoU 0.94, plan 92.2 m² / cell 89.8 m² (1.03); scale 12.35 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | F1@2 (MZ1/F1/F5): overlap IoU 0.95, plan 93.0 m² / cell 93.8 m² (0.99); scale 14.11 mm/px, tilt +0.00° |
| WARN | each floor's plan fits its key-plan cell | independent | F2@2 (MZ2/F2/F6): overlap IoU 0.76, plan 53.7 m² / cell 50.9 m² (1.06); scale 15.56 mm/px, tilt -0.27° |
| PASS | each floor's plan fits its key-plan cell | independent | F3@2 (MZ3/F3/F7): overlap IoU 0.91, plan 59.2 m² / cell 57.3 m² (1.03); scale 12.22 mm/px, tilt -0.22° |
| PASS | each floor's plan fits its key-plan cell | independent | F4@2 (MZ4/F4/F8): overlap IoU 0.95, plan 91.9 m² / cell 87.6 m² (1.05); scale 12.33 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | F5@3 (MZ1/F1/F5): overlap IoU 0.95, plan 93.0 m² / cell 93.8 m² (0.99); scale 14.11 mm/px, tilt +0.00° |
| WARN | each floor's plan fits its key-plan cell | independent | F6@3 (MZ2/F2/F6): overlap IoU 0.76, plan 53.7 m² / cell 50.9 m² (1.06); scale 15.56 mm/px, tilt -0.27° |
| PASS | each floor's plan fits its key-plan cell | independent | F7@3 (MZ3/F3/F7): overlap IoU 0.92, plan 59.2 m² / cell 58.1 m² (1.02); scale 12.22 mm/px, tilt -0.22° |
| PASS | each floor's plan fits its key-plan cell | independent | F8@3 (MZ4/F4/F8): overlap IoU 0.94, plan 92.2 m² / cell 90.1 m² (1.02); scale 12.35 mm/px, tilt +0.00° |
| WARN | each floor's plan fits its key-plan cell | independent | F9@4 (F9 lower): overlap IoU 0.84, plan 78.8 m² / cell 93.8 m² (0.84); scale 13.63 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | F9@5 (F9 upper): overlap IoU 0.84, plan 76.2 m² / cell 67.3 m² (1.13); scale 13.63 mm/px, tilt +0.00° |
| PASS | each floor's plan fits its key-plan cell | independent | F10@4 (F10 lower): overlap IoU 0.92, plan 57.6 m² / cell 54.0 m² (1.07); scale 15.07 mm/px, tilt +0.38° |
| PASS | each floor's plan fits its key-plan cell | independent | F10@5 (F10 upper): overlap IoU 0.94, plan 45.3 m² / cell 43.8 m² (1.04); scale 15.07 mm/px, tilt -0.37° |
| PASS | each floor's plan fits its key-plan cell | independent | F11@4 (F11 lower): overlap IoU 0.89, plan 52.4 m² / cell 57.3 m² (0.92); scale 13.99 mm/px, tilt -0.16° |
| WARN | each floor's plan fits its key-plan cell | independent | F11@5 (F11 upper): overlap IoU 0.82, plan 54.6 m² / cell 47.4 m² (1.15); scale 13.99 mm/px, tilt -0.70° |
| PASS | each floor's plan fits its key-plan cell | independent | F12@4 (F12 lower): overlap IoU 0.92, plan 92.4 m² / cell 90.1 m² (1.03); scale 14.65 mm/px, tilt -0.72° |
| PASS | each floor's plan fits its key-plan cell | independent | F12@5 (F12 upper): overlap IoU 0.95, plan 62.2 m² / cell 60.7 m² (1.02); scale 14.65 mm/px, tilt -0.23° |
| WARN | plans that span the block are as deep as the block | independent | LW1@-1: plan 10.45 m across, block 9.70 m (OSM-fitted; +7.6%, allowed 5%) |
| WARN | plans that span the block are as deep as the block | independent | LW1@0: plan 10.83 m across, block 9.70 m (OSM-fitted; +11.6%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | LW2@-1: plan 9.96 m across, block 9.70 m (OSM-fitted; +2.6%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | LW2@0: plan 9.41 m across, block 9.70 m (OSM-fitted; -3.0%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | MZ1@1: plan 9.95 m across, block 9.70 m (OSM-fitted; +2.5%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | MZ4@1: plan 10.11 m across, block 9.70 m (OSM-fitted; +4.2%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | F1@2: plan 9.98 m across, block 9.70 m (OSM-fitted; +2.8%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | F4@2: plan 10.10 m across, block 9.70 m (OSM-fitted; +4.0%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | F5@3: plan 9.98 m across, block 9.70 m (OSM-fitted; +2.8%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | F8@3: plan 10.11 m across, block 9.70 m (OSM-fitted; +4.2%, allowed 5%) |
| PASS | plans that span the block are as deep as the block | independent | F9@4: plan 9.40 m across, block 9.70 m (OSM-fitted; -3.1%, allowed 5%) |
| WARN | plans that span the block are as deep as the block | independent | F12@4: plan 10.56 m across, block 9.70 m (OSM-fitted; +8.9%, allowed 5%) |
| PASS | plans printed on one page are drawn to one scale | independent | page 1: MZ3/F3/F7 12.22, MZ4/F4/F8 12.35 mm/px (1% apart; the brochure prints each plan to fit its page, so this is not required) |
| WARN | plans printed on one page are drawn to one scale | independent | page 2: MZ1/F1/F5 14.11, MZ2/F2/F6 15.56 mm/px (10% apart; the brochure prints each plan to fit its page, so this is not required) |
| WARN | plans printed on one page are drawn to one scale | independent | page 3: F9 lower 13.63, F9 upper 13.63, F10 lower 15.07, F10 upper 15.07 mm/px (11% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 4: F11 lower 13.99, F11 upper 13.99, F12 lower 14.65, F12 upper 14.65 mm/px (5% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 5: M2 ground 12.96, M2 upper 12.96, M3 ground 12.91, M3 upper 12.91 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 6: M1 ground 12.00, M1 upper 12.00 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 7: H1 ground 11.24, H1 first 11.24 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 8: H1 second 11.24, H1 third 11.24 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 9: LW1 lower ground 15.18, LW1 ground 15.18 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |
| PASS | plans printed on one page are drawn to one scale | independent | page 10: LW2 lower ground 13.35, LW2 ground 13.35 mm/px (0% apart; the brochure prints each plan to fit its page, so this is not required) |

## LiDAR

| status | check | basis | detail |
|---|---|---|---|
| PASS | the LiDAR shows each unit floor built | independent | LW1 on the ground floor: roof median 18.1 m above the street, 18.1 m over its floor (100% of the roof clears 2.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | LW2 on the ground floor: roof median 18.1 m above the street, 18.1 m over its floor (99% of the roof clears 2.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M1 on the ground floor: roof median 6.5 m above the street, 6.5 m over its floor (100% of the roof clears 2.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M1 on the mezzanine floor: roof median 6.5 m above the street, 3.5 m over its floor (81% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M2 on the ground floor: roof median 6.6 m above the street, 6.6 m over its floor (100% of the roof clears 2.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M2 on the mezzanine floor: roof median 6.6 m above the street, 3.6 m over its floor (89% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M3 on the ground floor: roof median 5.9 m above the street, 5.9 m over its floor (100% of the roof clears 2.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | M3 on the mezzanine floor: roof median 6.0 m above the street, 3.0 m over its floor (80% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | H1 on the mezzanine floor: roof median 13.6 m above the street, 10.6 m over its floor (94% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | H1 on the first floor: roof median 13.6 m above the street, 7.6 m over its floor (84% of the roof clears 8.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | H1 on the second floor: roof median 13.6 m above the street, 4.6 m over its floor (74% of the roof clears 11.4 m) |
| WARN | the LiDAR shows each unit floor built | independent | H1 on the third floor: roof median 14.3 m above the street, 2.3 m over its floor (19% of the roof clears 14.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | MZ1 on the mezzanine floor: roof median 18.1 m above the street, 15.1 m over its floor (99% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | MZ2 on the mezzanine floor: roof median 18.1 m above the street, 15.1 m over its floor (97% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | MZ3 on the mezzanine floor: roof median 18.1 m above the street, 15.1 m over its floor (100% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | MZ4 on the mezzanine floor: roof median 18.1 m above the street, 15.1 m over its floor (98% of the roof clears 5.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F1 on the first floor: roof median 18.1 m above the street, 12.1 m over its floor (99% of the roof clears 8.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F2 on the first floor: roof median 18.1 m above the street, 12.1 m over its floor (97% of the roof clears 8.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F3 on the first floor: roof median 18.1 m above the street, 12.1 m over its floor (100% of the roof clears 8.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F4 on the first floor: roof median 18.1 m above the street, 12.1 m over its floor (98% of the roof clears 8.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F5 on the second floor: roof median 18.1 m above the street, 9.1 m over its floor (96% of the roof clears 11.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F6 on the second floor: roof median 18.1 m above the street, 9.1 m over its floor (95% of the roof clears 11.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F7 on the second floor: roof median 18.1 m above the street, 9.1 m over its floor (100% of the roof clears 11.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F8 on the second floor: roof median 18.1 m above the street, 9.1 m over its floor (97% of the roof clears 11.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F9 on the third floor: roof median 18.1 m above the street, 6.1 m over its floor (93% of the roof clears 14.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F9 on the fourth floor: roof median 18.1 m above the street, 3.1 m over its floor (96% of the roof clears 17.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F10 on the third floor: roof median 18.1 m above the street, 6.1 m over its floor (87% of the roof clears 14.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F10 on the fourth floor: roof median 18.1 m above the street, 3.1 m over its floor (87% of the roof clears 17.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F11 on the third floor: roof median 18.1 m above the street, 6.1 m over its floor (98% of the roof clears 14.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F11 on the fourth floor: roof median 18.1 m above the street, 3.1 m over its floor (89% of the roof clears 17.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F12 on the third floor: roof median 18.1 m above the street, 6.1 m over its floor (97% of the roof clears 14.4 m) |
| PASS | the LiDAR shows each unit floor built | independent | F12 on the fourth floor: roof median 18.1 m above the street, 3.1 m over its floor (80% of the roof clears 17.4 m) |

## IFC model

| status | check | basis | detail |
|---|---|---|---|
| PASS | IFC built from this model | derived | ifc/build.json matches |
| PASS | IFC4 file valid (ifcopenshell.validate) | derived | 0 errors |
| PASS | every unit floor is an IfcSpace | derived | 34 of 34 |
| PASS | no two spaces on a storey overlap | derived |  |

## register

| status | check | basis | detail |
|---|---|---|---|
| PASS | each postal address is one unit, each unit one address | derived |  |
| PASS | every unit has a postal address | derived |  |
| PASS | postal addresses matched at least `likely` | independent | 1 likely, 6 strong, 15 confirmed; possible:  |
| WARN | a matched unit's EPC area is its brochure area | derived | LW1 = 152 Lever Street: EPC 207 m², brochure 262.53 m² (0.79; allowed 0.88-1.12) |
| WARN | a matched unit's EPC area is its brochure area | derived | LW2 = Flat 21: EPC 108 m², brochure 251.66 m² (0.43; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | M1 = Flat 2: EPC 85 m², brochure 80.82 m² (1.05; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | M2 = Flat 3: EPC 82 m², brochure 78.96 m² (1.04; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | M3 = Flat 4: EPC 53 m², brochure 51.28 m² (1.03; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | MZ1 = Flat 5: EPC 91 m², brochure 87.51 m² (1.04; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | MZ2 = Flat 6: EPC 48 m², brochure 48.02 m² (1.00; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | MZ3 = Flat 7: EPC 59 m², brochure 54.25 m² (1.09; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | MZ4 = Flat 8: EPC 95 m², brochure 86.39 m² (1.10; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F1 = Flat 9: EPC 90 m², brochure 87.97 m² (1.02; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F2 = Flat 10: EPC 47 m², brochure 48.21 m² (0.97; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F3 = Flat 11: EPC 57 m², brochure 54.53 m² (1.05; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F4 = Flat 12: EPC 87 m², brochure 86.11 m² (1.01; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F5 = Flat 13: EPC 92 m², brochure 87.97 m² (1.05; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F6 = Flat 14: EPC 49 m², brochure 48.21 m² (1.02; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F7 = Flat 15: EPC 58 m², brochure 54.53 m² (1.06; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F8 = Flat 16: EPC 84 m², brochure 86.39 m² (0.97; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F9 = Flat 17: EPC 148 m², brochure 146.31 m² (1.01; allowed 0.88-1.12) |
| WARN | a matched unit's EPC area is its brochure area | derived | F10 = Flat 18: EPC 104 m², brochure 91.78 m² (1.13; allowed 0.88-1.12) |
| WARN | a matched unit's EPC area is its brochure area | derived | F11 = Flat 19: EPC 86 m², brochure 98.0 m² (0.88; allowed 0.88-1.12) |
| PASS | a matched unit's EPC area is its brochure area | derived | F12 = Flat 20: EPC 143 m², brochure 142.22 m² (1.01; allowed 0.88-1.12) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 4: the plan is M3's, matched to M3 (strong) |
| PASS | an agent's measured area is the brochure's | independent | Flat 4 = M3: 547 sq ft measured, 552 printed (0.99; allowed 0.90-1.10) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 6: the plan is MZ2's, matched to MZ2 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 6 = MZ2: 538 sq ft measured, 517 printed (1.04; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 6 = MZ2: labelled First Floor; MZ2 is on the brochure's Mezzanine (counting the mezzanine: First Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 7: the plan is MZ3's, matched to MZ3 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 7 = MZ3: 611 sq ft measured, 584 printed (1.05; allowed 0.90-1.10) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 9: the plan is F1's, matched to F1 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 9 = F1: 978 sq ft measured, 947 printed (1.03; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 9 = F1: labelled First Floor; F1 is on the brochure's First Floor (counting the mezzanine: Second Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 11: the plan is F3's, matched to F3 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 11 = F3: 597.5 sq ft measured, 587 printed (1.02; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 11 = F3: labelled First Floor; F3 is on the brochure's First Floor (counting the mezzanine: Second Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 12: the plan is F4's, matched to F4 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 12 = F4: 940 sq ft measured, 927 printed (1.01; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 12 = F4: labelled First Floor; F4 is on the brochure's First Floor (counting the mezzanine: Second Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 13: the plan is F5's, matched to F5 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 13 = F5: 1014 sq ft measured, 947 printed (1.07; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 13 = F5: labelled Second Floor; F5 is on the brochure's Second Floor (counting the mezzanine: Third Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 14: the plan is F6's, matched to F6 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 14 = F6: 523 sq ft measured, 519 printed (1.01; allowed 0.90-1.10) |
| KNOWN | an agent's floor label fits the matched floor | independent | Flat 14 = F6: labelled First Floor; F6 is on the brochure's Second Floor (counting the mezzanine: Third Floor) — K-0001: the user: "Flat 14 is in the 2nd floor", the brochure's Second Floor, where C-0001 puts F6; the agent's "First Floor" label is wrong |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 15: the plan is F7's, matched to F7 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 15 = F7: 598 sq ft measured, 587 printed (1.02; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 15 = F7: labelled Second Floor; F7 is on the brochure's Second Floor (counting the mezzanine: Third Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 17: the plan is F9's, matched to F9 (confirmed) |
| PASS | an agent's measured area is the brochure's | independent | Flat 17 = F9: 1636 sq ft measured, 1575 printed (1.04; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 17 = F9: labelled Third Floor, Fourth Floor; F9 is on the brochure's Third Floor and Fourth Floor (counting the mezzanine: Fourth Floor and Fifth Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 18: the plan is F10's, matched to F10 (strong) |
| WARN | an agent's measured area is the brochure's | independent | Flat 18 = F10: 1154 sq ft measured, 988 printed (1.17; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 18 = F10: labelled Fourth Floor, Fifth Floor; F10 is on the brochure's Third Floor and Fourth Floor (counting the mezzanine: Fourth Floor and Fifth Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 19: the plan is F11's, matched to F11 (strong) |
| PASS | an agent's measured area is the brochure's | independent | Flat 19 = F11: 1072 sq ft measured, 1055 printed (1.02; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 19 = F11: labelled Third Floor, Fourth Floor; F11 is on the brochure's Third Floor and Fourth Floor (counting the mezzanine: Fourth Floor and Fifth Floor) |
| PASS | an agent's floor plan is the matched unit's plan | independent | Flat 20: the plan is F12's, matched to F12 (strong) |
| PASS | an agent's measured area is the brochure's | independent | Flat 20 = F12: 1594 sq ft measured, 1531 printed (1.04; allowed 0.90-1.10) |
| PASS | an agent's floor label fits the matched floor | independent | Flat 20 = F12: labelled Fourth Floor, Fifth Floor; F12 is on the brochure's Third Floor and Fourth Floor (counting the mezzanine: Fourth Floor and Fifth Floor) |

## licences

| status | check | basis | detail |
|---|---|---|---|
| PASS | no brochure image is published (redrawn SVGs and our own renders only) | independent |  |

## user rules

| status | check | basis | detail |
|---|---|---|---|
| PASS | C-0001 (postal): “5–8 mezzanine (as assumed)” — user, 2026-11-09 | user rule | Flat 5 = MZ1, Flat 6 = MZ2, Flat 7 = MZ3, Flat 8 = MZ4, Flat 9 = F1, Flat 10 = F2, Flat 11 = F3, Flat 12 = F4, Flat 13 = F5, Flat 14 = F6, Flat 15 = F7, Flat 16 = F8 |
| PASS | C-0002 (postal): “Flat 17 is F9” — user, 2026-11-09 | user rule | Flat 17 = F9 |
| PASS | C-0003 (postal): “Flat 21 is LW2, but not sure if 152 Lever Street is LW1” — user, 2026-11-09 | user rule | Flat 21 = LW2 |
| PASS | C-0004 (stacks): “H1 townhouse's 1st and 2nd floor are not aligned with the floor above and floor below (the block outline, chosen over the mezzanine and 3rd floors' line)” — user, 2026-11-09 | user rule | the floors' walls are 0.02 m apart at most (south walls of H1@1 and H1@2; allowed 0.15 m) |
| PASS | C-0005 (stacks): “M1/M2/M3 have the same problems” — user, 2026-11-09 | user rule | the floors' walls are 0.02 m apart at most (west walls of M1@0 and M1@1; allowed 0.15 m) |
| PASS | C-0006 (stacks): “M1/M2/M3 have the same problems” — user, 2026-11-09 | user rule | the floors' walls are 0.00 m apart at most (west walls of M2@0 and M2@1; allowed 0.15 m) |
| PASS | C-0007 (stacks): “M1/M2/M3 have the same problems” — user, 2026-11-09 | user rule | the floors' walls are 0.00 m apart at most (east walls of M3@0 and M3@1; allowed 0.15 m) |
| PASS | C-0008 (postal): “confirmed 152 Lever Street is LW1” — user, 2026-11-09 | user rule | 152 Lever Street = LW1 |

## issues

| status | check | basis | detail |
|---|---|---|---|
| PASS | a rule from an issue quotes it word for word | user rule |  |
| PASS | an issue you accepted keeps its rule | user rule |  |
| PASS | issues waiting (open, or proposed for your review) | user rule |  |

## changes against main

- new building: not on main (every unit, plan and rule is new)
