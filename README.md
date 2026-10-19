# Pokédle

When the project was still in its early-stages, it was meant to be just a simple web application for Web Application Development course. Sometimes, I do extend it and make it a more complex experience, whenever ideas come to the mind and free time is available.

<br>

## Index

- Version Changelog
  - [V1.0.0](#v100)
  - [V1.1.0](#v110)
  - [V1.5.6](#v156)
  - [V1.6.0](#v160)
  - [V1.7.1](#v171)
  - [V1.8.0](#v180)
- [Troubleshooting and Suggestions](#troubleshooting-and-suggestions)

<br>

## V1.0.0

Pokédle is a game inspired by Wordle and LoLdle.<br>
The goal of this game is to guess a secret pokémon, which changes daily.<br>

All pokémons are represented by features such as `habitat` where they live, their `colors`, `types`, `evolution stage` (both the stage level and whether that stage is the last one of its evolution line) and `generation`.<br>
Based on each guess made, you will be given `colored hints` on each of these categories in relation to the secret pokémon ones.<br>
Such hints will help you figure out what is the secret pokémon by looking at their colors:<br>

- `green` is an `exact match` on that same category of the secret pokémon;<br>
- `yellow` is a `partial match` (meaning there are multiple values and one of them is correct);<br>
- `red` means there's `no match` at all.<br>

<br>

> [!TIP]
> If you want to keep track of your game stats, make sure to login with Google.

<br>

Visit Pokédle [here](https://pokedle.onrender.com/) and have fun guessing 'em all!

<br>

## V1.1.0

A new minor update has been implemented:<br>

- granted the admin privileges to server-side for Firestore Cloud Storage access through the `Firebase Admin SDK` module,
  allowing a strong, simple and secure implementation of the `Firebase Security Rules`;<br>

- moved `possibly-sensible data` to the hosting site using environment variables and secret files;<br>

- changed the CSS, EJS views and client's code to adapt to server-side changes.

<br>

## V1.5.6

Several minor updates have been implemented:<br>

- added `2nd, 3rd, 4th and 5th generation of pokémons`;<br>

- implemented the server-side verification of `Firebase ID Tokens` (based on JWT) for sensible requests, enhancing the security;<br>

- improved `data consistency` both on client and server, improved the `rendering` of guesses;<br>

- restructured the `API endpoints` to create a more intuitive hierarchical order, improved server-side `error handling`;<br>

- renamed the only mode currently available to `Classic` mode in prevision of new future game modes;<br>

- added more `backgrounds` for both PC and mobile resolutions, implemented a `background randomizer`;<br>

- changed the CSS, EJS views, static .webp assets and client's code.

<br>

## V1.6.0

A new minor update has been implemented:<br>

- restyled the `user interface`;<br>

- modularized the handling of `authentication` on client-side.

<br>

## V1.7.1

A new minor update has been implemented:<br>

- added new mode `Sentry Duty`, based on the mini-game of Pokémon Mystery Dungeon 2;

- added new logo image and new `GameBoy-like pokémon font`.

<br>

## V1.8.0

A new minor update has been implemented:<br>

- added `shiny pokémons`;

- restyled the `pokédex` view;

- restyled the `Sentry Duty` mode view;

- restyled the old `guess button`, from now on it is referred to as the `ball button`;

- added a few new game-like animations to the `ball button`;

- added `daily-consecutive win-streaks` for logged-in players with incremental upgrades to the `ball tier` of the `ball button` (pokeball -> great ball -> ultra ball -> master ball -> reset);

- each `ball tier` has an increasing chance of capturing a shiny version of the daily pokémon;

- added `PokéShop`, in which you can spend `PokéDollars`, earned by playing `Classic` mode, to buy some customization items (`backgrounds`, `overlays` and `companions`) for your own `profile` page;

- added purchasable `boosts` in the shop, such as `Master Ball tier boost` and `2x pokédollars boost`;

- added for all items an indipendent possibility of being `discounted` between 20% - 50% of their original cost;

- added customizable `usernames` for logged-in players;

- added medals to third, second and first places in `rankings` pages;

- added randomic trigger of `events`, as of right now there is a `legendary-only event` and a `2x pokédollars event`.

<br>

## Troubleshooting and Suggestions

If you are having trouble with the site (e.g. it looks broken), clearing the browser cache relative to this site is most likely the solution. Check [how to clear cache on Chrome](https://support.google.com/accounts/answer/32050?sjid=9309983268576311148-EU).

<br>

If you still need help for any problem, or if you have a cool idea that you would like to see implemented on this site, please feel free to make an issue here to reach me out! ^-^

<br>
