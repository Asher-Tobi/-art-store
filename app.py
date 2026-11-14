import os
from uuid import uuid4

from flask import Flask, abort, flash, redirect, render_template, request, session, url_for

app = Flask(__name__)

# Set SECRET_KEY in your environment before deployment.
# The fallback is only for local development and must not be used in production.
app.secret_key = os.environ.get("SECRET_KEY", "local-development-key-change-before-deploy")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=2 * 1024 * 1024,
)

# Sample catalogue data. Prices are in USD.
products = [
    {
        "id": 1, "title": "Desert Path", "artist": "Nadia Attura",
        "category": "Photography", "price": 1440.0, "price_display": "$1,440",
        "size": "40 x 40 in",
        "image": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        "description": "A luminous desert study with warm tones and quiet movement, designed for collectors who love atmospheric light and minimalist wall presence.",
    },
    {
        "id": 2, "title": "Color Fields of Topanga State Park", "artist": "Suren Ter-Avakian",
        "category": "Painting", "price": 4370.0, "price_display": "$4,370",
        "size": "30 x 24 in",
        "image": "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80",
        "description": "Layered color field abstraction inspired by California landscapes, blending cool and warm tones into a tactile composition with emotional depth.",
    },
    {
        "id": 3, "title": "Powerflowers", "artist": "Hennie Van De Lande",
        "category": "Painting", "price": 6095.0, "price_display": "$6,095",
        "size": "39.4 x 59.1 in",
        "image": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80",
        "description": "Bold floral abstraction that balances gestural motion and structure, creating a confident statement piece for contemporary interiors.",
    },
    {
        "id": 4, "title": "Biological Transformation", "artist": "Paul Chang",
        "category": "Painting", "price": 2825.0, "price_display": "$2,825",
        "size": "32 x 40 in",
        "image": "https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=900&q=80",
        "description": "A richly layered figurative work that explores growth, memory, and mutation through vivid color and texture.",
    },
    {
        "id": 5, "title": "Morning Forest #2", "artist": "Igor Vitomirov",
        "category": "Photography", "price": 1680.0, "price_display": "$1,680",
        "size": "39.4 x 27.6 in",
        "image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
        "description": "A misty woodland photograph that captures quiet depth and atmosphere with a cinematic sense of stillness.",
    },
    {
        "id": 6, "title": "Dream of Dogwood Flowers", "artist": "Natalia Shardakova",
        "category": "Painting", "price": 1730.0, "price_display": "$1,730",
        "size": "36 x 48 in",
        "image": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80",
        "description": "A lyrical floral composition that brings tenderness and rhythm to modern living spaces through layered brushwork.",
    },
    {
        "id": 7, "title": "July Aspens", "artist": "Emily Kent",
        "category": "Photography", "price": 904.0, "price_display": "$904",
        "size": "38 x 26 in",
        "image": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80",
        "description": "A quiet landscape photograph with expressive natural contrast, ideal for collectors drawn to transparent light and serene compositions.",
    },
    {
        "id": 8, "title": "An Evening Walk", "artist": "Suren Ter-Avakian",
        "category": "Painting", "price": 5480.0, "price_display": "$5,480",
        "size": "30 x 30 in",
        "image": "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
        "description": "An atmospheric painting that reads like a twilight memory, balancing earthy pigment with layered, reflective motion.",
    },
]

featured_collection = [
    {
        "id": 9, "title": "Cosiness", "artist": "Henriette Fabricius",
        "category": "Painting", "price": 1940.0, "price_display": "$1,940",
        "size": "39.4 x 39.4 in",
        "image": "https://images.unsplash.com/photo-1520637836862-4d197d17c90a?auto=format&fit=crop&w=900&q=80",
        "description": "A comforting abstract with sculptural color relationships, built for calm, warm, inviting interiors.",
    },
    {
        "id": 10, "title": "Tiger In St. Moritz", "artist": "Paul Fuentes",
        "category": "Photography", "price": 1550.0, "price_display": "$1,550",
        "size": "33.5 x 43.3 in",
        "image": "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=900&q=80",
        "description": "An adventurous, high-contrast photograph with refined detail and a striking sense of place and movement.",
    },
    {
        "id": 11, "title": "Azul", "artist": "Mireia Cifuentes",
        "category": "Painting", "price": 2880.0, "price_display": "$2,880",
        "size": "45.3 x 57.1 in",
        "image": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
        "description": "A vivid blue composition with atmospheric depth, ideal for collectors seeking strong color and luminous scale.",
    },
    {
        "id": 12, "title": "Trees in Blue", "artist": "Vahe Yeremyan",
        "category": "Painting", "price": 3375.0, "price_display": "$3,375",
        "size": "30 x 45 in",
        "image": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        "description": "A blue-toned landscape that creates depth and calm, balancing structure, movement, and painterly atmosphere.",
    },
]

all_products = products + featured_collection
product_lookup = {str(product["id"]): product for product in all_products}
categories = ["Paintings", "Photography", "Sculpture", "Drawings", "Mixed Media", "Fine Art Prints"]


def get_product_by_id(product_id):
    """Look up an item across both homepage collections."""
    return product_lookup.get(str(product_id))


def get_cart():
    """Return a sanitized cart dictionary with valid product IDs and quantities."""
    raw_cart = session.get("cart", {})
    if not isinstance(raw_cart, dict):
        return {}

    clean_cart = {}
    for product_id, quantity in raw_cart.items():
        if get_product_by_id(product_id) is None:
            continue
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            continue
        if 1 <= quantity <= 20:
            clean_cart[str(product_id)] = quantity
    return clean_cart


def get_cart_count():
    return sum(get_cart().values())


def get_cart_items():
    items = []
    for product_id, quantity in get_cart().items():
        product = get_product_by_id(product_id)
        if product:
            items.append({**product, "quantity": quantity})
    return items


def calculate_totals(cart_items):
    subtotal = sum(item["price"] * item["quantity"] for item in cart_items)
    shipping = 0.0 if subtotal >= 1500 else (65.0 if subtotal else 0.0)
    return subtotal, shipping, subtotal + shipping


@app.context_processor
def inject_global_template_values():
    return {"cart_count": get_cart_count(), "brand_name": "ART STUDIO"}


@app.route("/")
def home():
    return render_template(
        "index.html",
        categories=categories,
        products=products,
        featured_collection=featured_collection,
    )


@app.route("/product/<int:product_id>")
def product_detail(product_id):
    product = get_product_by_id(product_id)
    if product is None:
        abort(404)
    return render_template("product.html", product=product)


@app.route("/search")
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return redirect(url_for("home"))
    needle = query.casefold()
    results = [
        product for product in all_products
        if needle in product["title"].casefold()
        or needle in product["artist"].casefold()
        or needle in product["category"].casefold()
    ]
    return render_template("index.html", categories=categories, products=results,
                           featured_collection=[], search_query=query)


@app.route("/cart", methods=["GET", "POST"])
def cart():
    if request.method == "POST":
        action = request.form.get("action", "")
        product_id = request.form.get("product_id", "")
        current_cart = get_cart()

        if action == "remove":
            current_cart.pop(str(product_id), None)
        elif action == "update":
            try:
                quantity = int(request.form.get("quantity", "1"))
            except (TypeError, ValueError):
                quantity = 1
            if quantity <= 0:
                current_cart.pop(str(product_id), None)
            elif quantity <= 20 and get_product_by_id(product_id):
                current_cart[str(product_id)] = quantity
            else:
                flash("Please choose a quantity between 1 and 20.")

        session["cart"] = current_cart
        return redirect(url_for("cart"))

    cart_items = get_cart_items()
    subtotal, shipping, total = calculate_totals(cart_items)
    return render_template("cart.html", cart_items=cart_items,
                           subtotal=subtotal, shipping=shipping, total=total)


@app.route("/add-to-cart", methods=["POST"])
def add_to_cart():
    product_id = request.form.get("product_id", "")
    product = get_product_by_id(product_id)
    if product is None:
        abort(404)

    try:
        quantity = int(request.form.get("quantity", "1"))
    except (TypeError, ValueError):
        quantity = 1

    if not 1 <= quantity <= 20:
        flash("Please choose a quantity between 1 and 20.")
        return redirect(url_for("product_detail", product_id=product["id"]))

    current_cart = get_cart()
    new_quantity = current_cart.get(str(product["id"]), 0) + quantity
    if new_quantity > 20:
        flash("A maximum of 20 of each artwork can be added to the cart.")
        new_quantity = 20
    current_cart[str(product["id"])] = new_quantity
    session["cart"] = current_cart
    flash(f'{product["title"]} was added to your cart.')
    return redirect(url_for("cart"))


@app.route("/checkout", methods=["GET", "POST"])
def checkout():
    cart_items = get_cart_items()
    if not cart_items:
        flash("Your cart is empty.")
        return redirect(url_for("cart"))

    subtotal, shipping, total = calculate_totals(cart_items)

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip()
        payment_method = request.form.get("payment_method", "")

        if len(name) < 2 or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            flash("Please enter a valid name and email address.")
        elif payment_method not in {"bitcoin", "card"}:
            flash("Please select a payment method.")
        else:
            # This is an order request only. No payment is collected or verified here.
            order = {
                "reference": uuid4().hex[:10].upper(),
                "name": name,
                "email": email,
                "payment_method": payment_method,
                "payment_status": "pending",
                "total": total,
                "items": cart_items,
            }
            session["order"] = order
            session["cart"] = {}
            return redirect(url_for("checkout_success"))

    return render_template("checkout.html", cart_items=cart_items,
                           subtotal=subtotal, shipping=shipping, total=total)


@app.route("/checkout-success")
def checkout_success():
    order = session.get("order")
    if not order:
        return redirect(url_for("home"))
    return render_template("checkout_success.html", order=order)


@app.route("/clear-cart", methods=["POST"])
def clear_cart():
    session["cart"] = {}
    flash("Your cart has been cleared.")
    return redirect(url_for("cart"))


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1")
