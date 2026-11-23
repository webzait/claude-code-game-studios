# Pop-up position: measured rectangles (finding B10)

Written by `POPUP_SHOTS=1 npx playwright test popup-position --workers=1`. All values in CSS px from the top of the screen.
"Card bottom" includes the 9 px wall under the card. "Free space" is what lies between that wall and the top of the helper buttons.

| Screen | Form | Card top (with stars) | Card bottom | Top of helper buttons | Free space | Lowest pop-up button ends at | Command buttons start at |
|---|---|---|---|---|---|---|---|
| 320×568 | win | 168 | 416.2 | 423.2 | 7 | 394.2 | 483.1 |
| 320×568 | win-last | 168 | 416.2 | 423.2 | 7 | 394.2 | 483.1 |
| 320×568 | win-calm | 168 | 416.2 | 423.2 | 7 | 394.2 | 483.1 |
| 320×568 | lost-offer | 146 | 416.2 | 423.2 | 7 | 387.2 | 483.1 |
| 320×568 | lost-no-offer | 187 | 416.2 | 423.2 | 7 | 402.2 | 483.1 |
| 360×640 | win | 209.5 | 473.8 | 480.8 | 7 | 447.8 | 546.1 |
| 360×640 | win-last | 209.5 | 473.8 | 480.8 | 7 | 447.8 | 546.1 |
| 360×640 | win-calm | 209.5 | 473.8 | 480.8 | 7 | 447.8 | 546.1 |
| 360×640 | lost-offer | 193.2 | 473.8 | 480.8 | 7 | 440.8 | 546.1 |
| 360×640 | lost-no-offer | 234.2 | 473.8 | 480.8 | 7 | 455.8 | 546.1 |
| 390×844 | win | 360.3 | 658 | 665 | 7 | 632 | 730.4 |
| 390×844 | win-last | 360.3 | 658 | 665 | 7 | 632 | 730.4 |
| 390×844 | win-calm | 360.3 | 658 | 665 | 7 | 632 | 730.4 |
| 390×844 | lost-offer | 363.4 | 658 | 665 | 7 | 625 | 730.4 |
| 390×844 | lost-no-offer | 404.4 | 658 | 665 | 7 | 640 | 730.4 |
| 430×932 | win | 436.3 | 734 | 741 | 7 | 708 | 806.4 |
| 430×932 | win-last | 436.3 | 734 | 741 | 7 | 708 | 806.4 |
| 430×932 | win-calm | 436.3 | 734 | 741 | 7 | 708 | 806.4 |
| 430×932 | lost-offer | 439.4 | 734 | 741 | 7 | 701 | 806.4 |
| 430×932 | lost-no-offer | 480.4 | 734 | 741 | 7 | 716 | 806.4 |
