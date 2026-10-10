from PIL import Image

try:
    img = Image.open('src_v2/assets/CU.png').convert("RGBA")
    
    # Create a white background image
    background = Image.new("RGBA", img.size, (255, 255, 255, 255))
    
    # Paste the original image on top (using itself as mask for transparency)
    background.paste(img, (0, 0), img)
    
    # Save as icon.png (overwriting the root icon.png which is used for the app)
    # The user asked for "The windows icon", which is usually the main icon.png
    background.save('icon.png', 'PNG')
    print("Successfully created icon.png with white background")
    
except Exception as e:
    print(f"Error: {e}")
