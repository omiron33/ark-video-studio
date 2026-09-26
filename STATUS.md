# Status

## v3

ETA: the corrected v3 shot render should take about 35 minutes (72 cached-depth segments) plus about 2 minutes to concat and mux. It runs straight through with no approval stop. Output is ../full/genesis7_full_v3.mp4 and ../full/genesis7_contact_v3.png. v1 and v2 stay untouched.

Actual render: 2267.62 s for the 72 segments, concat, and contact sheet. A short repair then redrew s23, s24, and s58 (159 s) so the sons line can sit behind the cloaks and the whirlpool line stays readable. The picture is 367.208 s, 8813 frames, 1920x1080, 24 fps, H.264 yuv420p, AAC, about 699 MB.

Check frames in ../full/v3_checks/:

- v3_checks/font_cormorant.png at 10.70 s, Cormorant, top, small, Then the Lord said to Noah,
- v3_checks/font_archivo.png at 24.81 s, Archivo Black, diagonal, Come into the ark, you and all your household,
- v3_checks/font_dirt.png at 47.72 s, Rubik Dirt, bottom, Of the animals not counted clean,
- v3_checks/font_cinzel.png at 53.75 s, Cinzel, right, Take also seven pairs of the birds,
- v3_checks/font_stencil.png at 142.14 s, Stardos Stencil, large, the great deep broke open.
- v3_checks/glitch_1.png at 142.87 s, glitch, the great deep broke open.
- v3_checks/glitch_2.png at 189.38 s, glitch, Then the Lord shut them in.
- v3_checks/glitch_3.png at 257.83 s, glitch, was swept away.
- v3_checks/text_behind.png at 119.44 s, the sons line across the cloaked figures, lanterns at their sides, words still readable.
- v3_checks/lightning.png and v3_checks/beat_no_strip.png at 3.83 s, a bolt in the cloud, no hero lyric, no full-width centre strip.
- v3_checks/s03.png at 10.64 s, the first Noah clause only, warm light on the figure rather than a horizon band.
- v3_checks/lantern.png at 119.44 s, camp lanterns, local light.

| index | start | end | text | font | layout | entrance | exit | fx |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 10.00 | 21.64 | Then the Lord said to Noah, | cormorant | top | tracking | slide_right | ink |
| 1 | 24.11 | 30.96 | Come into the ark, you and all your household, | archivo | diagonal | slide_left | slide_below | fade |
| 2 | 31.08 | 36.44 | For I have seen you walking rightly before Me in this generation. | archivo | diagonal | zoom | blur | fade |
| 3 | 36.44 | 39.70 | Take with you the clean animals, | cormorant | left | tracking | wipe | ink |
| 4 | 40.44 | 47.02 | Seven pairs of every kind, male and female together. | archivo | diagonal | typewriter | slide_left | fade |
| 5 | 47.02 | 52.52 | Of the animals not counted clean, take one pair, male and female. | dirt | bottom | slide_left | slide_right | fade |
| 6 | 53.05 | 58.06 | Take also seven pairs of the birds, | cinzel | right | zoom | blur | typewriter |
| 7 | 59.08 | 66.45 | So their kind may continue across the face of the earth. | archivo | top | zoom | wipe | fade |
| 8 | 67.18 | 79.23 | God said “For after seven more days, rain will fall upon the earth | cinzel | center | wipe | zoom | light_sweep |
| 9 | 79.25 | 81.39 | For forty days and forty nights. | cinzel | diagonal | blur | slide_left | ink |
| 10 | 81.39 | 84.10 | I will sweep away from the face of the ground | cinzel | right | typewriter | slide_below | fade |
| 11 | 84.10 | 86.72 | Every living thing that I have made. | dirt | left | slide_left | zoom | fade |
| 12 | 86.72 | 90.57 | And Noah did everything the Lord commanded. | dirt | left | wipe | slide_right | typewriter |
| 13 | 96.75 | 113.67 | Noah was six hundred years old when the waters came upon the earth. | dirt | bottom | zoom | slide_left | fade |
| 14 | 113.67 | 119.56 | Noah entered the ark, and with him came his sons: Shem, Ham, and Japheth. | archivo | diagonal | wipe | ink | fade |
| 15 | 119.56 | 122.02 | His wife entered with him, and the wives of his sons. | dirt | bottom | typewriter | slide_below | typewriter |
| 16 | 122.02 | 125.52 | The animals came also: clean and unclean, | dirt | left | zoom | fade | fade |
| 17 | 125.52 | 128.72 | Birds of the air, and every creature that moved along the ground. | dirt | bottom | zoom | slide_left | fade |
| 18 | 128.72 | 135.06 | They entered by pairs, male and female, just as God had commanded Noah. | cinzel | right | typewriter | ink | typewriter |
| 19 | 137.10 | 138.41 | Seven days passed. | cinzel | diagonal | ink | slide_below | ink |
| 20 | 138.41 | 139.28 | Then the waters came. | cinzel | diagonal | blur | wipe | ink |
| 21 | 139.28 | 141.44 | In the six hundredth year of Noah’s life, | cinzel | right | slide_right | slide_left | typewriter |
| 22 | 141.44 | 145.28 | In the second month, on the seventeenth day, the great deep broke open. | stencil | right | shake | ink | glitch |
| 23 | 145.28 | 147.80 | The fountains beneath the earth burst | stencil | bottom | stamp | ink | embers |
| 24 | 147.80 | 150.53 | from their places, and the heavens opened above. | stencil | diagonal | shake | slide_below | embers |
| 25 | 150.59 | 152.77 | Rain poured upon the earth | cinzel | bottom | ink | slide_below | light_sweep |
| 26 | 152.77 | 154.79 | For forty days and forty nights. | cinzel | diagonal | blur | slide_left | ink |
| 27 | 154.79 | 159.08 | That same day Noah entered the ark, with Shem, Ham, and Japheth. | cinzel | center | slide_right | zoom | typewriter |
| 28 | 159.08 | 161.95 | His wife was with him, and the wives of his sons. | archivo | diagonal | slide_left | ink | fade |
| 29 | 161.95 | 164.17 | Every beast after its kind, | cinzel | bottom | blur | slide_left | ink |
| 30 | 164.17 | 168.06 | Every animal after its kind, every creature moving on the ground, | archivo | diagonal | slide_right | slide_below | typewriter |
| 31 | 168.06 | 170.42 | Every bird and every winged thing. | cinzel | diagonal | ink | slide_below | ink |
| 32 | 170.42 | 174.80 | They came to Noah, two by two, all carrying the breath of life. | dirt | bottom | typewriter | blur | fade |
| 33 | 174.80 | 181.26 | They entered the ark, male and female, as God had commanded. | archivo | top | slide_right | fade | typewriter |
| 34 | 188.50 | 191.60 | Then the Lord shut them in. | stencil | right | shake | slide_below | glitch |
| 35 | 199.11 | 202.12 | The Flood rose for forty days. | stencil | right | stamp | slide_below | stamp |
| 36 | 202.12 | 207.63 | The waters increased and lifted the ark high above the earth. | cinzel | center | slide_left | slide_right | typewriter |
| 37 | 207.63 | 210.80 | Higher they climbed, stronger they became, | cinzel | diagonal | ink | fade | ink |
| 38 | 210.80 | 215.12 | Until the ark moved across the face of the waters. | archivo | top | typewriter | wipe | fade |
| 39 | 215.20 | 218.77 | The floodwaters grew greatly, and | bebas | center | shake | slide_right | typewriter |
| 40 | 218.77 | 221.73 | every high mountain beneath the whole heaven was covered. | cinzel | center | zoom | fade | light_sweep |
| 41 | 221.79 | 224.20 | The waters rose above them | cormorant | center | tracking | wipe | ink |
| 42 | 224.20 | 230.67 | Until even the highest ground disappeared below. | dirt | left | slide_right | slide_below | typewriter |
| 43 | 231.72 | 238.02 | Then every creature that moved upon the earth died. | stencil | bottom | shake | ink | fade |
| 44 | 238.02 | 242.56 | Birds, livestock, wild beasts, creeping things, and mankind. | dirt | left | typewriter | slide_right | fade |
| 45 | 242.56 | 249.18 | Everything on dry land that carried the breath of life came to its end. | archivo | top | slide_right | fade | typewriter |
| 46 | 249.31 | 257.14 | The waters covered what once had been fields, roads, homes, and living ground. | archivo | diagonal | wipe | slide_below | fade |
| 47 | 257.14 | 264.68 | Every living thing upon the face of the earth was swept away. | stencil | bottom | shake | slide_below | glitch |
| 48 | 264.68 | 268.72 | Man and beast, creeping thing and bird, all were taken from the land. | dirt | bottom | wipe | blur | typewriter |
| 49 | 268.72 | 275.19 | Only Noah remained, and those who were with him inside the ark. | cormorant | left | tracking | wipe | ink |
| 50 | 275.19 | 278.66 | Above them, the waters still moved. | cormorant | top | tracking | slide_right | ink |
| 51 | 278.66 | 283.47 | Around them, the old world was gone. | cormorant | top | fade | slide_left | ink |
| 52 | 283.96 | 292.67 | For one hundred and fifty days, the waters remained strong upon the earth. | cormorant | center | tracking | wipe | ink |
| 53 | 292.86 | 295.11 | No mountain stood above them. | cinzel | diagonal | blur | wipe | ink |
| 54 | 295.11 | 297.06 | No field broke through. | cormorant | left | tracking | wipe | ink |
| 55 | 297.06 | 298.57 | No road returned. | cinzel | diagonal | blur | wipe | ink |
| 56 | 298.62 | 301.65 | No human voice answered outside. | cinzel | bottom | ink | slide_below | ink |
| 57 | 301.65 | 306.69 | Only the ark remained upon the endless waters, | cormorant | top | fade | zoom | ink |
| 58 | 306.69 | 308.41 | Carrying Noah, his household, | cinzel | right | ink | fade | ink |
| 59 | 308.41 | 311.49 | And the living creatures God had preserved within. | cormorant | center | tracking | wipe | ink |
| 60 | 311.49 | 312.63 | The rain had fallen. | cinzel | bottom | ink | slide_below | light_sweep |
| 61 | 312.63 | 314.69 | The earth was covered. | cinzel | diagonal | blur | slide_left | ink |
| 62 | 316.26 | 319.34 | The judgment had come. | cinzel | left | blur | slide_left | ink |
| 63 | 319.34 | 328.18 | And beneath a darkened heaven, the waters still prevailed. | cormorant | center | fade | slide_left | light_sweep |

## Sentences

The word-by-word film is ../full/genesis7_full.mp4 with contact sheet ../full/genesis7_contact.png. That file is left alone. The sentence cut is ../full/genesis7_full_v2.mp4 with ../full/genesis7_contact_v2.png. Textless plates were rendered once (2041.61 s) and the sentences were composited again over those plates, so the motion was not rendered again. Lyrics are full sentences, not comma fragments. The v2 picture is 367.208 s, 8813 frames, 1920x1080, 24 fps, H.264 CRF 20, AAC, about 512 MB.

Check frames in ../full/sentence_checks/:

- sentence_checks/slide_entrance.png at 24.21 s, sentence 1, slide from the right, mid entrance, Come into the ark, You and all your household,
- sentence_checks/shake_hit.png at 142.88 s, sentence 18, shake on the downbeat, In the second month, On the seventeenth day, The great deep broke open.
- sentence_checks/fade_entrance.png at 207.75 s, sentence 30, fade entrance, Higher they climbed, Stronger they became,
- sentence_checks/held_two_line.png at 10.54 s, sentence 0, fully held two-line sentence, Then the Lord said to Noah,
- sentence_checks/shem_ham_japheth.png at 116.62 s, sentence 12, Shem, Ham, and Japheth in one sentence, Noah entered the ark, And with him came his sons: Shem, Ham, And Japheth.
- sentence_checks/instrumental_gap.png at 4.00 s, no hero lyric, verse line only.

| index | start | end | text | entrance | exit |
| --- | --- | --- | --- | --- | --- |
| 0 | 10.00 | 21.64 | Then the Lord said to Noah, | tracking | fade |
| 1 | 24.11 | 30.96 | Come into the ark, You and all your household, | slide_right | slide_left |
| 2 | 31.08 | 36.44 | For I have seen you walking rightly Before Me in this generation. | slide_left | scale |
| 3 | 36.44 | 47.02 | Take with you the clean animals, Seven pairs of every kind, Male and female together. | wipe | slide_below |
| 4 | 47.02 | 52.52 | Of the animals not counted clean, Take one pair, Male and female. | scale | wipe |
| 5 | 53.05 | 58.06 | Take also seven pairs of the birds, | slide_below | slide_right |
| 6 | 59.08 | 66.45 | So their kind may continue Across the face of the earth. | slide_left | scale |
| 7 | 67.18 | 74.83 | God said “For after seven more days, | slide_right | scale |
| 8 | 75.11 | 81.39 | Rain will fall upon the earth For forty days And forty nights. | slide_below | slide_left |
| 9 | 81.39 | 90.57 | I will sweep away From the face of the ground Every living thing That I have made. And Noah did Everything the Lord commanded. | wipe | slide_below |
| 10 | 96.75 | 104.18 | Noah was | blur | tracking |
| 11 | 109.91 | 113.67 | six hundred years old When the waters came upon the earth. | slide_left | scale |
| 12 | 113.67 | 119.56 | Noah entered the ark, And with him came his sons: Shem, Ham, And Japheth. | slide_below | slide_right |
| 13 | 119.56 | 122.02 | His wife entered with him, And the wives of his sons. | wipe | slide_below |
| 14 | 122.02 | 126.34 | The animals came also: Clean and unclean, Birds of the air, | slide_below | slide_right |
| 15 | 126.34 | 128.72 | And every creature That moved along the ground. | slide_right | slide_left |
| 16 | 128.72 | 135.06 | They entered by pairs, Male and female, Just as God had commanded Noah. | slide_below | slide_left |
| 17 | 137.10 | 141.44 | Seven days passed. Then the waters came. In the six hundredth year Of Noah’s life, | wipe | slide_right |
| 18 | 141.44 | 145.28 | In the second month, On the seventeenth day, The great deep broke open. | shake | scale |
| 19 | 145.28 | 150.53 | The fountains beneath the earth Burst from their places, And the heavens opened above. | scale | slide_below |
| 20 | 150.59 | 154.79 | Rain poured upon the earth For forty days And forty nights. | slide_left | wipe |
| 21 | 154.79 | 159.08 | That same day Noah entered the ark, With Shem, Ham, And Japheth. | slide_right | scale |
| 22 | 159.08 | 161.95 | His wife was with him, And the wives of his sons. | slide_below | slide_left |
| 23 | 161.95 | 166.40 | Every beast after its kind, Every animal after its kind, | wipe | slide_below |
| 24 | 166.40 | 170.42 | Every creature moving on the ground, Every bird and every winged thing. | slide_below | slide_right |
| 25 | 170.42 | 174.80 | They came to Noah, Two by two, All carrying the breath of life. | slide_right | slide_left |
| 26 | 174.80 | 181.26 | They entered the ark, Male and female, As God had commanded. | slide_left | scale |
| 27 | 188.50 | 191.60 | Then the Lord shut them in. | shake | slide_left |
| 28 | 199.11 | 202.12 | The Flood rose for forty days. | wipe | slide_right |
| 29 | 202.12 | 207.63 | The waters increased And lifted the ark High above the earth. | scale | wipe |
| 30 | 207.63 | 210.80 | Higher they climbed, Stronger they became, | fade | blur |
| 31 | 210.80 | 215.12 | Until the ark moved Across the face of the waters. | wipe | slide_below |
| 32 | 215.20 | 217.83 | The floodwaters grew greatly, | shake | slide_right |
| 33 | 217.84 | 221.73 | And every high mountain Beneath the whole heaven Was covered. | slide_left | scale |
| 34 | 221.79 | 230.67 | The waters rose above them Until even the highest ground Disappeared below. | scale | wipe |
| 35 | 231.72 | 238.02 | Then every creature That moved upon the earth died. | shake | slide_left |
| 36 | 238.02 | 242.56 | Birds, Livestock, Wild beasts, Creeping things, And mankind. | slide_below | slide_right |
| 37 | 242.56 | 249.18 | Everything on dry land That carried the breath of life Came to its end. | slide_left | scale |
| 38 | 249.31 | 257.14 | The waters covered What once had been fields, Roads, Homes, And living ground. | wipe | slide_below |
| 39 | 257.14 | 264.68 | Every living thing Upon the face of the earth Was swept away. | shake | scale |
| 40 | 264.68 | 268.72 | Man and beast, Creeping thing and bird, All were taken from the land. | slide_below | slide_right |
| 41 | 268.72 | 275.19 | Only Noah remained, And those who were with him Inside the ark. | tracking | fade |
| 42 | 275.19 | 278.66 | Above them, The waters still moved. | fade | blur |
| 43 | 278.66 | 283.47 | Around them, The old world was gone. | blur | tracking |
| 44 | 283.96 | 292.67 | For one hundred and fifty days, The waters remained strong Upon the earth. | fade | blur |
| 45 | 292.86 | 295.11 | No mountain stood above them. | tracking | fade |
| 46 | 295.11 | 297.06 | No field broke through. | fade | blur |
| 47 | 297.06 | 301.65 | No road returned. No human voice answered outside. | blur | tracking |
| 48 | 301.65 | 307.58 | Only the ark remained Upon the endless waters, Carrying Noah, | fade | blur |
| 49 | 307.58 | 311.49 | His household, And the living creatures God had preserved within. | blur | tracking |
| 50 | 311.49 | 314.69 | The rain had fallen. The earth was covered. | slide_right | slide_left |
| 51 | 316.26 | 319.34 | The judgment had come. | tracking | fade |
| 52 | 319.34 | 328.18 | And beneath a darkened heaven, The waters still prevailed. | fade | blur |

## Full2 72-shot film

Output: `../full/genesis7_full.mp4` and `../full/genesis7_contact.png`. 1920x1080, 24 fps, H.264 yuv420p CRF 20, AAC. Container duration 367.160 s, video duration 367.125 s, both within 0.1 s of 367.2 s. File size 936 MB. The older `out/genesis7_full.mp4` was left in place.

Render time: 2153.87 s of segment encoding, 2168.50 s wall clock, including depth prep. A second launch skipped all 72 finished segments.

| id | in | out | camera | layers | text treatment | pass/notes |
| --- | --- | --- | --- | --- | --- | --- |
| s01 | 0.000 | 6.084 | slow push in | clouds, fog, dust, grass, lightning | condense_fog | pass, preview treatment kept |
| s02 | 6.084 | 10.588 | low slider across grass | clouds, fog, dust, grass, motes, lightning | lightning_flash | pass, preview treatment kept |
| s03 | 10.588 | 17.369 | slow crane up and push | clouds, fog, dust, grass, godrays, motes, lightning | shaft_descend | pass, preview treatment kept |
| s04 | 17.369 | 24.102 | slow tilt down | clouds, fog, dust, godrays, motes | chisel_rock | pass, preview treatment kept |
| s05 | 24.102 | 26.355 | slow lateral drift | clouds, fog, dust | sink_fade | pass |
| s06 | 26.355 | 30.859 | slow push toward fires | clouds, fog, dust, motes | shaft_descend | pass |
| s07 | 30.859 | 33.112 | low dolly in | clouds, fog, dust | chisel_rock | pass |
| s08 | 33.112 | 36.502 | slow tilt up the hull | clouds, fog, rain | shaft_descend | pass |
| s09 | 36.502 | 39.845 | slow pan | clouds, fog, dust, grass | slide_across | pass |
| s10 | 39.845 | 44.350 | low tracking follow | clouds, fog, dust, grass | shaft_descend | pass |
| s11 | 44.350 | 48.832 | slow push along path | clouds, fog, dust, rain | chisel_rock | pass |
| s12 | 48.832 | 53.336 | slow orbit | clouds, fog, grass, rain | sink_fade | pass |
| s13 | 53.336 | 57.841 | tilt down | clouds, fog, dust | shaft_descend | pass |
| s14 | 57.841 | 62.322 | slow push along roofline | clouds, fog, rain | chisel_rock | pass |
| s15 | 62.322 | 64.575 | very slow pull back | clouds, fog, dust, lightning | shaft_descend | pass |
| s16 | 64.575 | 67.180 | slow drift | clouds, fog, dust | sink_fade | pass |
| s17 | 67.180 | 73.538 | slow push in | clouds, fog, lightning, rain | chisel_rock | pass |
| s18 | 73.538 | 81.386 | slow push toward rain | clouds, fog, grass, lightning, rain | shaft_descend | pass |
| s19 | 81.386 | 86.982 | slow lateral drift | clouds, fog, dust, rain | chisel_rock | pass |
| s20 | 86.982 | 90.349 | slow push | clouds, fog, dust, motes | shaft_descend | pass |
| s21 | 90.349 | 100.426 | slow crane up | clouds, fog, rain | chisel_rock | pass |
| s22 | 100.426 | 111.618 | low slow push | clouds, fog, rain | shaft_descend | pass |
| s23 | 111.618 | 116.100 | slow push | clouds, fog, rain | chisel_rock | pass |
| s24 | 116.100 | 122.787 | handheld follow | clouds, fog, rain | shaft_descend | pass |
| s25 | 122.787 | 129.498 | slow dolly in | clouds, fog, rain | chisel_rock | pass |
| s26 | 129.498 | 137.100 | low static, slight push | clouds, fog, dust, rain | shaft_descend | pass |
| s27 | 137.100 | 140.643 | slow push in | clouds, fog, rain | chisel_rock | pass |
| s28 | 140.643 | 143.987 | macro slow motion feel | clouds, fog, dust, rain | shaft_descend | pass |
| s29 | 143.987 | 147.331 | slow push, shake on hits | clouds, fog, godrays, rain, water | chisel_rock | pass |
| s30 | 147.331 | 149.537 | low push, heavy shake | clouds, fog, water | shaft_descend | pass |
| s31 | 149.537 | 151.766 | slow tilt down | clouds, fog, lightning, rain | chisel_rock | pass |
| s32 | 151.766 | 154.790 | slow pan | clouds, fog, rain, water | sink_fade | pass |
| s33 | 154.790 | 158.407 | slow push | clouds, fog, rain | float_bob | pass |
| s34 | 158.407 | 163.933 | handheld close follow | clouds, fog, rain | shaft_descend | pass |
| s35 | 163.933 | 167.253 | slow dolly along the line | clouds, fog, rain | slide_across | pass |
| s36 | 167.253 | 171.665 | macro low slide | clouds, fog, rain | shaft_descend | pass |
| s37 | 171.665 | 176.077 | slow push | clouds, fog, rain | slide_across | pass |
| s38 | 176.077 | 180.489 | slow push | clouds, fog, rain | shaft_descend | pass |
| s39 | 180.489 | 182.718 | slow push | clouds, fog, rain | chisel_rock | pass |
| s40 | 182.718 | 187.000 | static, slow push toward opening | clouds, fog, godrays, rain, water | shaft_descend | pass |
| s41 | 187.000 | 189.382 | slow push, shake on hits | clouds, fog, lightning, rain | lightning_flash | pass |
| s42 | 189.382 | 193.000 | hard shake on slam, then still | clouds, fog, dust, lightning, rain | shaft_descend | pass |
| s43 | 193.000 | 196.023 | slow push, shake on sub hits | clouds, fog, lightning, rain | chisel_rock | pass |
| s44 | 196.023 | 199.110 | slow tilt, flash cuts | clouds, fog, lightning, rain | lightning_flash | pass |
| s45 | 199.110 | 202.664 | slow push | clouds, fog, godrays, rain, water | shaft_descend | pass |
| s46 | 202.664 | 207.006 | slow low push, gentle bob | clouds, fog, rain, water | float_bob | pass |
| s47 | 207.006 | 211.511 | gentle bob and drift | clouds, fog, rain, water | slide_across | pass |
| s48 | 211.511 | 215.946 | low tracking over waves | clouds, fog, godrays, rain, water | shaft_descend | pass |
| s49 | 215.946 | 220.381 | slow pan | clouds, fog, rain, water | chisel_rock | pass |
| s50 | 220.381 | 222.586 | slow push | clouds, fog, rain, water | sink_fade | pass |
| s51 | 222.586 | 227.021 | slow push in | clouds, fog, lightning, rain, water | chisel_rock | pass |
| s52 | 227.021 | 231.720 | very slow push | clouds, fog, rain, water | sink_fade | pass |
| s53 | 231.720 | 238.051 | slow drift | clouds, fog, rain, water | float_bob | pass |
| s54 | 238.051 | 243.554 | slow push | clouds, fog, rain | slide_across | pass |
| s55 | 243.554 | 251.240 | slow lateral drift | clouds, fog, rain, water | shaft_descend | pass |
| s56 | 251.240 | 257.140 | slow push | clouds, fog, rain, water | sink_fade | pass |
| s57 | 257.140 | 262.246 | push with shake on hits | clouds, fog, godrays, rain, water | shaft_descend | pass |
| s58 | 262.246 | 268.841 | slow top-down rotation | clouds, fog, rain, water | chisel_rock | pass |
| s59 | 268.841 | 273.206 | slow push in | clouds, fog, rain, water | shaft_descend | pass |
| s60 | 273.206 | 275.412 | slow push | clouds, fog, rain | chisel_rock | pass |
| s61 | 275.412 | 279.800 | low slow push over waves | clouds, fog, lightning, rain, water | float_bob | pass |
| s62 | 279.800 | 283.960 | very slow pull back | clouds, fog, rain, water | sink_fade | pass |
| s63 | 283.960 | 293.013 | very slow drift | clouds, fog, rain, water | chisel_rock | pass |
| s64 | 293.013 | 301.813 | static, slight push | clouds, fog, rain | sink_fade | pass |
| s65 | 301.813 | 306.225 | slow descending push | clouds, fog, water | shaft_descend | pass |
| s66 | 306.225 | 311.705 | slow tilt | clouds, fog, rain, water | chisel_rock | pass |
| s67 | 311.705 | 319.390 | slow push | clouds, fog, lightning, rain | lightning_flash | pass |
| s68 | 319.390 | 327.780 | slow push | clouds, fog, lightning, rain, water | chisel_rock | pass |
| s69 | 327.780 | 336.968 | very slow pull back | clouds, fog, water | float_bob | pass |
| s70 | 336.968 | 347.951 | very slow drift | clouds, fog, water | slide_across | pass |
| s71 | 347.951 | 356.821 | very slow drift, fade out | clouds, fog, water | sink_fade | pass, end fade |
| s72 | 356.821 | 367.200 | static, fade to black | clouds, fog, water | float_bob | pass, end fade |

Shared notes: consecutive shots do not all use the same type treatment. Hero lyrics are full sentences from lyrics.json, not one word at a time. The word-by-word cut is ../full/genesis7_full.mp4. The verse line is the smaller second layer. Parallax between depth layers stays tight so small figures do not split; the camera move carries the shot. Rain, dust, fog, grass, water, and lightning are the moving layers. Detail painted into a still does not all move. CRF 20 kept the file under 1.5 GB.

Phase: the 72-shot full2 film is rendered at ../full/genesis7_full.mp4. The s01 to s04 preview notes below still stand. out/genesis7_full.mp4 was not deleted.

## s01 to s04 preview

Output: `../full2/preview/s01_s04_preview.mp4` and `../full2/preview/frames_contact.png`. Song time 0.000 to 24.102. 1920x1080, 24 fps, H.264, AAC. Container duration 24.102 s. The picture stream is 578 frames (24.083 s) because 24.102 s is not an integer frame. Cuts sit on 6.084, 10.588, 17.369, and 24.102.

Render time, second pass, with depth already cached: 168.81 s. The pass before it was 167.05 s. Both used Depth Anything V2 on MPS from the prep cache.

- s01, 0.000 to 6.084. Slow push. Clouds roll, dust crosses the plain, fog sits on the ground, and the horizon lifts on beats. "GENESIS 7" gathers in the sky. The verse line finishes before the cut. The gather is subtle; the title is nearly set by one second.
- s02, 6.084 to 10.588. Low slide across the grass, with sway and dust. "THEN" is white for two frames with a frame lift, then a teal afterimage. The title stays faint above it. The verse sits low and does not cover the word.
- s03, 10.588 to 17.369. Crane and push. "THE", "LORD", and "SAID" land in the upper left of the shaft, clear of the figure. A soft beam flickers. The verse is small at the lower left. One silhouette on the ridge. A little haze in the beam is in the still.
- s04, 17.369 to 24.102. Tilt down. "TO" and "NOAH" sit on the lit rock at the right, with a dark inner edge. Chips are small, so the letters read as cut type more than a shower of stone. The verse is complete in the dark above the rock and does not cover the hero word.

Weak spots: the s02 flash lifts the whole frame, not only the letters. Parallax between layers is kept tight so the figure does not split, so the depth separation is modest and the move comes mostly from the camera. Source rain and dust in the stills do not all move; the moving dust, grass, fog, and clouds are the layers added on top.

## Full-video stills

Each file below was opened. Reuses of animals_ramp, ark_endless_aerial, dark_sea_rainfall, real_1, real_3, and gritty_C3 are one file each. real_1, real_3, and gritty_C3 were not regenerated.

- plain_storm.png. Empty plain, teal horizon, no people.
- command_ridge.png. Tiny cloaked figure from behind, no face, one shaft of light.
- ark_finished_dusk.png. Boxy flat-roof timber ark, tents, tiny cloaked figures. This is the ark reference used for later edits.
- noah_hull_wide.png. Low angle on the timber wall, cloaked figure from behind, lantern.
- herds_plain.png. Herds and a distant boxy ark.
- birds_sky.png. Tall rectangular hull from a low angle, flat roof as a thin top edge, flock above the roofline. The first pass was a barn on stilts. The second pass read as a low flat tray, so it was regenerated again from the tall hull.
- earth_vista.png. Wide land, river, tiny box ark. Regenerated after the first pass was a houseboat.
- storm_wall_sunset.png. Storm wall and a box ark on a hill. Regenerated after the first pass was a wagon.
- pitch_torchlight.png. Box hull, hooded figures with torches. They are closer than the other people, but the hoods hide the faces, so this pass stays. Regenerated earlier so the hull stayed a box.
- animals_ramp.png. Box ark, ramp, animals, one small cloaked figure.
- noah_ramp_behind.png. Box ark, ramp, cloaked figure with a staff from behind.
- sealed_ark_lightning.png. Sealed box ark in lightning, no door glow.
- family_boarding.png. Box ark, small cloaked figures, no faces. An earlier pass with large figures was rejected.
- fountains_burst.png. Box ark between two water bursts. An earlier houseboat pass was rejected.
- wild_animals_path.png. Animals on a path and a distant box ark. An earlier metal-shed pass was rejected.
- heavens_open.png. Sky opening over the storm.
- pair_elephants.png. Two elephants, rain, the box ark behind them.
- boarding_rain.png. Ramp and small cloaked figures in rain.
- ark_lantern_window.png. Sealed box with a small warm window.
- flood_rising_base.png. Water at the base of the box ark.
- ark_afloat.png. The box barge in heavy seas. Later sea shots were edited from this frame.
- mountains_submerging.png. Peaks going under, no ark.
- last_peak.png. One peak left above the flood.
- drowned_fields.png. Fields under brown water.
- drowned_village.png. Mud-brick roofs, a broken cart, flood water, no people.
- flood_current.png. Brown flood, uprooted trees, debris, lightning. No faces.
- dark_sea_rainfall.png. Edited from ark_afloat.png. Endless sea and a tiny rectangular ark on the horizon.
- ark_endless_aerial.png. Edited from ark_afloat.png. High view of the same barge. The first aerial was an open trough and was rejected. This one has a solid flat plank roof, no sails, no masts, no prow.

Rejected and not saved: a ship-prow ark, a curved-roof barn, a metal shed standing in for the ark, a houseboat, a wooden wagon, large foreground people, and an open-top aerial. Ark stills that came back as ships were redone with image_edit from the accepted box so the hull stayed a flat timber barge.

## Door seam and figure

After the slam the seam level stays at 0.72 instead of fading out. The seam is drawn after chromatic aberration so it does not pick up a green rim. Cloaked figures get a small local sway that is stronger at the shoulders than at the feet.

The 5 second clip section below is the earlier test. The full song replaces the fading seam with the steady one.

## What is done

`shots/ark_door_187.yaml` drives the clip. Prep upscales `../styles/real_1.png` to a 2304x1296 plate, runs relative Depth Anything V2 Small on MPS, saves `out/depth_preview.png`, splits four feathered layers, and Telea-fills the rim behind nearer layers. The second launch hits that cache and does not load the model again.

The closed door is not an inpaint. The opening is filled with a 1:1 copy of the wall planks beside it, so the courses, grain, and painted rain match the hull. A razor amber seam is drawn on that leaf at the slam and fades out over 0.5 seconds. While the door is open, the slit is rebuilt as fire with a hot core, darker edges, and vertical variation, instead of the flat clipped yellow in the plate. The slam frame and the frame after it take an exposure dip, and the ramp puddle loses its orange with the door.

The frame pass is still a slow low dolly-in with small drift and a tiny roll, layered rain, fog, a left-weighted lightning flash, grain, vignette, a 1 pixel chromatic shift, and a teal and amber grade. ffmpeg writes H.264 CRF 16, yuv420p, and AAC, with short fades.

## Render times

Cold prep, including Depth Anything V2 on MPS: 6.26 seconds.
Frame render, run 1: 63.53 seconds.
Cache-hit prep, run 2: 0.23 seconds. Depth Anything V2 was not loaded.
Frame render, run 2: 59.17 seconds.

Decoded slam frames from the two encodes match byte for byte.

## Cues

Measured from `../audio.json`, librosa onset strength, and a low-band envelope of `../song.mp3` from 187.0 to 192.0. The list is `shots/ark_door_187.cues.json`.

Flash is the beat-grid downbeat at 187.153. The nearest onset is 187.139. That is frame 4, shown at 187.17.

Door slam is the low-band attack at 190.460. The beat grid hit is 190.473. The low-band RMS maximum is 190.576 because the note sustains. The slam uses the attack (frame 83, shown at 190.46).

Pulses snapped to onsets within 0.03 seconds of the listed times: 187.580, 187.975, 188.254, 188.811, 189.090, 189.345, 191.574.

Words marked aligned false in lyrics.json are interpolated, so those cue times now follow GOAL.md. "shut" is aligned true, so it stays on the lyrics.json time.

- Then: GOAL.md 188.02. lyrics.json 188.50 to 188.95, aligned false.
- the: GOAL.md 189.02. lyrics.json 188.95 to 189.40, aligned false.
- Lord: GOAL.md 189.54. lyrics.json 189.40 to 189.85, aligned false.
- shut: lyrics.json 189.85 to 190.30, aligned true. GOAL.md 189.80.
- them: GOAL.md 190.18. lyrics.json 190.30 to 190.75, aligned false.
- in.: GOAL.md 190.46 to 191.8. lyrics.json 190.75 to 191.20, aligned false.

The slam stays on the musical hit at 190.460, not on the word "in".

## Check frames

All of these are 1920x1080 in `out/frames_check/`.

- `flash.png` is frame 4, the lightning flash (song time 187.17).
- `pre_flash.png` is frame 3.
- `pre_slam.png` is frame 81, door still open.
- `slam.png` is frame 83, the door slam.
- `post_slam.png` is frame 89, seam fading, shake mostly gone.
- `pulse.png` is frame 30.
- `mid.png` is frame 60.

`out/contact_sheet.png` is 12 frames with timestamp labels, including "187.17 flash" and "190.46 slam". The bottom row shows the seam thinning and then gone.

## Inspection

I opened the check frames and the contact sheet after this render.

Before the slam the slit is orange with a brighter core and darker edges, and the ramp and puddle carry that light. It is no longer a flat clipped yellow bar. At the slam the doorway is the neighboring plank texture, the ramp reflection is gone, the frame is darker (mean about 24 versus about 39 before and about 38 after), and the camera is shifted about 36 pixels versus about 4 on a pulse. The seam is a thin orange line on the slam frame, thinner a quarter second later, and absent by the last contact-sheet frames. The left side of the flash still lifts more than the right (about 60 levels versus about 26). I did not see the old dark smear and pale stretch inside the doorway, parallax holes, a halo on the man, or the plate edge.

## Remaining weak spots

The fire's interior beams are faint. The gap reads as a gradient with texture, not as clear posts. The closed leaf is a copy of the wall, so a careful look can still find the edge of that patch where it meets the frame. A little of the seam can sit just at the threshold. Rain painted into the source plate does not move. The moving streaks are the ones added on top.
