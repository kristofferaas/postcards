CREATE TABLE postcard_designs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  front_image_uri TEXT NOT NULL,
  back_image_uri TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sent_postcards (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  postcard_design_id INTEGER NOT NULL,
  front_image_uri TEXT NOT NULL,
  back_image_uri TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  opened_at TEXT,
  FOREIGN KEY (postcard_design_id) REFERENCES postcard_designs(id),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX sent_postcards_user_id_idx
ON sent_postcards(user_id);

CREATE INDEX sent_postcards_postcard_design_id_idx
ON sent_postcards(postcard_design_id);
