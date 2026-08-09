Switch away from on the fly generation and create a new script: generate_listings.py
This script will take each listing under `listings` and will stitch it with listing.html to create new pages (like /name_of_the_appartment)
The Open Graph implementation will now be static, i.e. no need to load it via JS, it will be generated through the script for maximal efficiency