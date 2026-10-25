-- Update the placeholder demo dishes without changing item IDs referenced by orders.
UPDATE menu_items
SET name = 'Grilled Octopus',
    description = 'Charred octopus with roasted peppers, herbs, and a bright citrus finish.',
    category = 'Starter',
    price = 168.00,
    image_url = '/menu-images/grilled-octopus-starter.png',
    is_available = TRUE
WHERE item_id = 1 AND name = 'Dish 1';

UPDATE menu_items
SET name = 'Grilled Wagyu Striploin',
    description = 'Grilled wagyu striploin served with seasonal vegetables and a rich pan jus.',
    category = 'Main',
    price = 328.00,
    image_url = '/menu-images/grilled-wagyu-striploin-main.png',
    is_available = TRUE
WHERE item_id = 2 AND name = 'Dish 2';

UPDATE menu_items
SET name = 'Oak & Negroni',
    description = 'A spirit-forward classic with gin, bitters, and oak-aged vermouth.',
    category = 'Beverage',
    price = 128.00,
    image_url = '/menu-images/oak-n-negroni-beverage.png',
    is_available = TRUE
WHERE item_id = 3 AND name = 'Dish 3';

UPDATE menu_items
SET name = 'Saffron Risotto',
    description = 'Creamy saffron risotto finished with parmesan and fresh herbs.',
    category = 'Main',
    price = 188.00,
    image_url = '/menu-images/saffron-risotto-main.png',
    is_available = TRUE
WHERE item_id = 4 AND name = 'Dish 4';

UPDATE menu_items
SET name = 'Seafood Medley with Lemon Beurre Blanc',
    description = 'A grilled seafood medley paired with a silky lemon beurre blanc.',
    category = 'Main',
    price = 268.00,
    image_url = '/menu-images/seafood-medley-lemon-beurre-blanc-main.png',
    is_available = TRUE
WHERE item_id = 5 AND name = 'Dish 5';

INSERT INTO menu_items (name, description, category, price, image_url, is_available)
SELECT 'Seasonal Cheesecake',
       'Rich, seasonal cheesecake with a golden top and a buttery biscuit base.',
       'Dessert',
       88.00,
       '/menu-images/seasonal-cheesecake-dessert.png',
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE name = 'Seasonal Cheesecake'
);

INSERT INTO menu_items (name, description, category, price, image_url, is_available)
SELECT 'Sparkling Rosemary Lemonade',
       'House-made sparkling lemonade infused with rosemary and fresh lemon.',
       'Beverage',
       68.00,
       '/menu-images/sparkling-rosemary-lemonade-beverage.png',
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE name = 'Sparkling Rosemary Lemonade'
);
