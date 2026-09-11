import os
from PIL import Image

ico_path = "icon.ico"

if os.path.exists(ico_path):
    print("Localizando ícone existente...")
    # Abre o ícone atual e força o redimensionamento mantendo a proporção em alta definição
    img = Image.open(ico_path)
    img_redimensionada = img.resize((256, 256), Image.Resampling.LANCZOS)
    
    # Salva por cima no formato ICO oficial do Windows exigido pelo builder
    img_redimensionada.save(ico_path, format="ICO", sizes=[(256, 256)])
    print("✅ Sucesso! O arquivo icon.ico agora está na resolução perfeita de 256x256.")
else:
    print("❌ Erro: O arquivo icon.ico não foi encontrado na pasta atual.")