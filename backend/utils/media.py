from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode

from models import Product

def _append_ngrok_bypass(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    if not hostname.endswith("ngrok-free.app"):
        return url
    params = parse_qsl(parsed.query, keep_blank_values=True)
    if any(key == "ngrok-skip-browser-warning" for key, _ in params):
        return url
    params.append(("ngrok-skip-browser-warning", "true"))
    new_query = urlencode(params)
    updated = parsed._replace(query=new_query)
    return urlunparse(updated)

def build_absolute_url(base_url: str, path: Optional[str]) -> Optional[str]:
    if not path:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return _append_ngrok_bypass(path)
    absolute = urljoin(base_url, path.lstrip("/"))
    return _append_ngrok_bypass(absolute)

def normalize_product_media(base_url: str, product: Product) -> None:
    if not product:
        return
    product.image_url = build_absolute_url(base_url, product.image_url)
    for image in getattr(product, "gallery_images", []):
        image.image_url = build_absolute_url(base_url, image.image_url)
