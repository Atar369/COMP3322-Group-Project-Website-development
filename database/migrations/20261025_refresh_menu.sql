-- Update the placeholder demo dishes without changing item IDs referenced by orders.
UPDATE menu_items
SET image_url = CONCAT('/uploads', image_url)
WHERE image_url LIKE '/menu-images/%';

UPDATE menu_items
SET
  description = CASE name
    WHEN 'Grilled Octopus' THEN 'Charred octopus with roasted peppers, herbs, and a bright citrus finish.'
    WHEN 'Grilled Wagyu Striploin' THEN 'Grilled wagyu striploin served with seasonal vegetables and a rich pan jus.'
    WHEN 'Oak & Negroni' THEN 'A spirit-forward classic with gin, bitters, and oak-aged vermouth.'
    WHEN 'Saffron Risotto' THEN 'Creamy saffron risotto finished with parmesan and fresh herbs.'
    WHEN 'Seafood Medley with Lemon Beurre Blanc' THEN 'A grilled seafood medley paired with a silky lemon beurre blanc.'
    WHEN 'Seasonal Cheesecake' THEN 'Rich, seasonal cheesecake with a golden top and a buttery biscuit base.'
    WHEN 'Sparkling Rosemary Lemonade' THEN 'House-made sparkling lemonade infused with rosemary and fresh lemon.'
    ELSE description
  END,
  category = CASE name
    WHEN 'Grilled Octopus' THEN 'Starter'
    WHEN 'Grilled Wagyu Striploin' THEN 'Main'
    WHEN 'Oak & Negroni' THEN 'Beverage'
    WHEN 'Saffron Risotto' THEN 'Main'
    WHEN 'Seafood Medley with Lemon Beurre Blanc' THEN 'Main'
    WHEN 'Seasonal Cheesecake' THEN 'Dessert'
    WHEN 'Sparkling Rosemary Lemonade' THEN 'Beverage'
    ELSE category
  END,
  price = CASE name
    WHEN 'Grilled Octopus' THEN 168.00
    WHEN 'Grilled Wagyu Striploin' THEN 328.00
    WHEN 'Oak & Negroni' THEN 128.00
    WHEN 'Saffron Risotto' THEN 188.00
    WHEN 'Seafood Medley with Lemon Beurre Blanc' THEN 268.00
    WHEN 'Seasonal Cheesecake' THEN 88.00
    WHEN 'Sparkling Rosemary Lemonade' THEN 68.00
    ELSE price
  END,
  image_url = CASE name
    WHEN 'Grilled Octopus' THEN '/uploads/menu-images/grilled-octopus-starter.png'
    WHEN 'Grilled Wagyu Striploin' THEN '/uploads/menu-images/grilled-wagyu-striploin-main.png'
    WHEN 'Oak & Negroni' THEN '/uploads/menu-images/oak-n-negroni-beverage.png'
    WHEN 'Saffron Risotto' THEN '/uploads/menu-images/saffron-risotto-main.png'
    WHEN 'Seafood Medley with Lemon Beurre Blanc' THEN '/uploads/menu-images/seafood-medley-lemon-beurre-blanc-main.png'
    WHEN 'Seasonal Cheesecake' THEN '/uploads/menu-images/seasonal-cheesecake-dessert.png'
    WHEN 'Sparkling Rosemary Lemonade' THEN '/uploads/menu-images/sparkling-rosemary-lemonade-beverage.png'
    ELSE image_url
  END
WHERE name IN (
  'Grilled Octopus',
  'Grilled Wagyu Striploin',
  'Oak & Negroni',
  'Saffron Risotto',
  'Seafood Medley with Lemon Beurre Blanc',
  'Seasonal Cheesecake',
  'Sparkling Rosemary Lemonade'
);

UPDATE menu_items
SET image_url = CASE item_id
  WHEN 1 THEN '/uploads/menu-images/grilled-octopus-starter.png'
  WHEN 2 THEN '/uploads/menu-images/grilled-wagyu-striploin-main.png'
  WHEN 3 THEN '/uploads/menu-images/oak-n-negroni-beverage.png'
  WHEN 4 THEN '/uploads/menu-images/saffron-risotto-main.png'
  WHEN 5 THEN '/uploads/menu-images/seafood-medley-lemon-beurre-blanc-main.png'
  WHEN 6 THEN '/uploads/menu-images/seasonal-cheesecake-dessert.png'
  WHEN 7 THEN '/uploads/menu-images/sparkling-rosemary-lemonade-beverage.png'
  ELSE image_url
END
WHERE item_id BETWEEN 1 AND 7
  AND image_url LIKE '/menu-images/%';