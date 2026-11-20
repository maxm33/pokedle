import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from io import BytesIO
import json
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

try:
    from PIL import Image
except ImportError as error:
    raise SystemExit(
        "Pillow is required. Install it with `python -m pip install Pillow`."
    ) from error


BASE_URL = "https://pokeforge.com"
LISTING_URL = f"{BASE_URL}/pokemon"
OUTPUT_SIZE = (546, 970)
DEFAULT_PRICE = 1200
USER_AGENT = "Pokedle background updater/1.0"
PUBLISHED_DATE = date.today().isoformat()


def find_project_root(script_path):
    for candidate in (script_path.parent, *script_path.parents):
        if (
            (candidate / "data" / "shopBackgrounds.json").is_file()
            and (candidate / "public" / "images" / "shop" / "backgrounds").is_dir()
        ):
            return candidate
    raise RuntimeError(
        "Could not find the project root (expected data/shopBackgrounds.json "
        "and public/images/shop/backgrounds)."
    )


ROOT = find_project_root(Path(__file__).resolve())
OUTPUT_DIRECTORY = ROOT / "public" / "images" / "shop" / "backgrounds"
CATALOG_PATH = ROOT / "data" / "shopBackgrounds.json"


@dataclass(frozen=True)
class Card:
    slug: str
    image_url: str


class CardListingParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cards = {}
        self.missing_image_slugs = set()
        self.current_slug = None
        self.current_source = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            path = urlsplit(attrs.get("href", "")).path
            if path.startswith("/pokemon/") and path.count("/") == 2:
                self.current_slug = unquote(path.rsplit("/", 1)[-1]).lower()
                self.current_source = None
        elif tag == "img" and self.current_slug and not self.current_source:
            self.current_source = self._get_card_source(attrs)
            if self.current_source:
                image_url = urljoin(BASE_URL, self.current_source)
                parsed_url = urlsplit(image_url)
                if (
                    parsed_url.scheme != "https"
                    or parsed_url.hostname != "pokeforge.com"
                ):
                    raise ValueError(f"Unexpected image URL: {image_url}")

                card = Card(self.current_slug, image_url)
                previous = self.cards.get(card.slug)
                if previous and previous != card:
                    raise ValueError(f"Conflicting listing entries for {card.slug}")
                self.cards[card.slug] = card

    def handle_endtag(self, tag):
        if tag == "a" and self.current_slug:
            if not self.current_source:
                self.missing_image_slugs.add(self.current_slug)
            self.current_slug = None
            self.current_source = None

    @staticmethod
    def _get_card_source(attrs):
        candidates = []
        for candidate in attrs.get("srcset", "").split(","):
            parts = candidate.strip().split()
            if not parts or "/cards/" not in urlsplit(parts[0]).path:
                continue
            width = 0
            if len(parts) > 1 and parts[1].endswith("w"):
                try:
                    width = int(parts[1][:-1])
                except ValueError:
                    continue
            candidates.append((width, parts[0]))

        if candidates:
            return max(candidates, key=lambda item: item[0])[1]

        source = attrs.get("src", "")
        source_path = urlsplit(source).path
        if "/cards/" in source_path and not source_path.endswith("-480.webp"):
            return source
        return None


def fetch_bytes(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except (URLError, TimeoutError) as error:
            if attempt == 2:
                raise RuntimeError(f"Failed to fetch {url}") from error
            time.sleep(2**attempt)


def get_listing_cards():
    parser = CardListingParser()
    parser.feed(fetch_bytes(LISTING_URL).decode("utf-8"))
    if parser.missing_image_slugs:
        missing = ", ".join(sorted(parser.missing_image_slugs)[:10])
        raise RuntimeError(f"Entries had no card image: {missing}")
    if not parser.cards:
        raise RuntimeError("No cards were found on the listing page.")
    return list(parser.cards.values())


def card_name(slug):
    words = slug.split("-")
    return " ".join(word if word == "ex" else word.capitalize() for word in words)


def download_and_crop(card):
    image_data = fetch_bytes(card.image_url)
    with Image.open(BytesIO(image_data)) as image:
        image.load()
        width, height = image.size
        target_width = round(height * 9 / 16)
        if width < target_width:
            raise RuntimeError(
                f"{card.slug}: source image is too narrow for a 9:16 crop "
                f"({width}x{height})"
            )

        crop_each_side = (width - target_width + 1) // 2
        cropped = image.crop(
            (crop_each_side, 0, width - crop_each_side, height)
        )
        if cropped.mode not in ("RGB", "RGBA"):
            mode = "RGBA" if "A" in cropped.getbands() else "RGB"
            cropped = cropped.convert(mode)
        if cropped.size != OUTPUT_SIZE:
            cropped = cropped.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)

        OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT_DIRECTORY / f"{card.slug}.webp"
        file_descriptor, temporary_path = tempfile.mkstemp(
            prefix=f".{card.slug}-", suffix=".webp", dir=OUTPUT_DIRECTORY
        )
        os.close(file_descriptor)
        try:
            cropped.save(temporary_path, format="WEBP", quality=95, method=6)
            os.replace(temporary_path, destination)
        finally:
            if os.path.exists(temporary_path):
                os.unlink(temporary_path)
    return card.slug


def write_catalog(items):
    file_descriptor, temporary_path = tempfile.mkstemp(
        prefix=".shopBackgrounds-", suffix=".json", dir=CATALOG_PATH.parent
    )
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as file:
            json.dump(items, file, ensure_ascii=False, indent=2)
            file.write("\n")
        os.replace(temporary_path, CATALOG_PATH)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)


def main():
    argument_parser = argparse.ArgumentParser(
        description=(
            "Find cards missing from the shop backgrounds folder, "
            "download and center-crop them to 9:16, then update the shop catalog."
        )
    )
    argument_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="show missing images and catalog entries without changing files",
    )
    args = argument_parser.parse_args()

    cards = get_listing_cards()
    items = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(items, list):
        raise RuntimeError(f"Expected a JSON array in {CATALOG_PATH}")

    items_by_id = {}
    for item in items:
        item_id = item.get("id")
        if not item_id or item_id in items_by_id:
            raise RuntimeError(f"Invalid or duplicate shop item ID: {item_id}")
        items_by_id[item_id] = item

    card_prices = {
        item["price"]
        for item in items
        if item["id"].startswith("pokeforge-") and "price" in item
    }
    if len(card_prices) > 1:
        raise RuntimeError("Background prices are inconsistent.")
    price = next(iter(card_prices), DEFAULT_PRICE)

    missing_images = []
    added_catalog_entries = 0
    catalog_changed = False
    for card in cards:
        item_id = f"pokeforge-{card.slug}"
        image_path = OUTPUT_DIRECTORY / f"{card.slug}.webp"
        image_url = f"/public/images/shop/backgrounds/{card.slug}.webp"
        if not image_path.is_file():
            missing_images.append(card)

        existing_item = items_by_id.get(item_id)
        if existing_item:
            if (
                existing_item.get("desktopUrl") != image_url
                or existing_item.get("mobileUrl") != image_url
            ):
                existing_item["desktopUrl"] = image_url
                existing_item["mobileUrl"] = image_url
                catalog_changed = True
        else:
            new_item = {
                "id": item_id,
                "name": f"{card_name(card.slug)} Background",
                "price": price,
                "desktopUrl": image_url,
                "mobileUrl": image_url,
                "publishedAt": PUBLISHED_DATE,
            }
            items.append(new_item)
            items_by_id[item_id] = new_item
            added_catalog_entries += 1
            catalog_changed = True

    print(
        f"Found {len(cards)} cards; "
        f"{len(missing_images)} image(s) need downloading; "
        f"{added_catalog_entries} catalog item(s) will be added."
    )
    if args.dry_run:
        for card in missing_images[:10]:
            print(f"  {card.slug}")
        if len(missing_images) > 10:
            print(f"  ... and {len(missing_images) - 10} more")
        return 0

    if missing_images:
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(download_and_crop, card)
                for card in missing_images
            ]
            for future in as_completed(futures):
                print(f"Downloaded {future.result()}")

    if catalog_changed:
        write_catalog(items)
        print(f"Updated {CATALOG_PATH.relative_to(ROOT)}.")
        print("Restart the server to load the updated shop backgrounds.")
    elif not missing_images:
        print("Shop backgrounds are already up to date.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
