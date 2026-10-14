# Where the source media lives

The kit's inputs are not in the repo and must never be added to it. `.gitignore`
keeps `carousel/my-images/`, `carousel/output/`, `carousel/runs/` and
`carousel/profile.json` out of git — private photography and generated slides
both.

## crew-drop/src is a symlink into iCloud Drive

    carousel/my-images/crew-drop/src  ->  ~/Library/Mobile Documents/com~apple~CloudDocs/CarouselKit/crew-drop/src

The 210 originals behind the Kigali set (6.87 GB of iPhone `.MOV`/`.HEIC` and
WhatsApp `.MP4`) were moved there on 15 Oct 2026, because 6.87 GB of raw footage
on a 228 GB SSD is not a sane place to keep it. They sit **evicted**: the bytes
are in iCloud and macOS pulls a file down when something opens it, so every
script that reads `src/` still works — the first read of a large clip just takes
a moment.

What this means in practice:

- **Don't copy the files back into the project.** If the symlink is missing,
  recreate the link.
- **Don't run a whole-folder pass you don't need.** Reading all of `src/`
  re-downloads all 6.87 GB. Work from `review/order.txt` and the picks, which is
  what the pipeline already does.
- **Verify rather than trust.** `crew-drop/src-manifest-2026-10-15.txt` in that
  iCloud folder has MD5, size and name for all 210 files, recorded before the
  move. Compare with `md5 -q <file>`.

## The same rule for anything new

A fresh drop of client or crew media goes in `CarouselKit/` in iCloud Drive and
is linked in, or goes on an external drive. Only code, templates, knowledge
notes and the style reference sheets belong in the repo.
