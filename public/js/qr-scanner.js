// public/js/qr-scanner.js
console.log("✅ qr-scanner.js cargado correctamente");

let html5QrCode = null;

window.startQRScanner = function() {
    console.log("📷 Iniciando escáner QR...");

    const modalHTML = `
        <div id="qr-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;display:flex;align-items:center;justify-content:center;">
            <div style="background:#1e2937;padding:25px;border-radius:16px;width:90%;max-width:520px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="color:white;margin:0;">📷 Escanear Código QR</h3>
                    <button onclick="stopQRScanner()" style="background:none;border:none;color:#ef4444;font-size:28px;cursor:pointer;">✕</button>
                </div>
                <div id="qr-reader" style="width:100%; min-height:320px; background:#000; border-radius:8px; overflow:hidden;"></div>
                <p style="color:#94a3b8; text-align:center; margin-top:10px; font-size:14px;">
                    Apunta la cámara al código QR del equipo
                </p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Inicializar el escáner
    html5QrCode = new Html5Qrcode("qr-reader");

    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 15, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
            // Cuando detecta un QR
            stopQRScanner();
            handleQRResult(decodedText);
        }
    ).catch((err) => {
        console.error(err);
        alert("❌ No se pudo acceder a la cámara.\nAsegúrate de permitir el acceso a la cámara.");
        stopQRScanner();
    });
};

window.stopQRScanner = function() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            const modal = document.getElementById('qr-modal');
            if (modal) modal.remove();
            html5QrCode = null;
        }).catch(() => {
            const modal = document.getElementById('qr-modal');
            if (modal) modal.remove();
        });
    }
};

async function handleQRResult(serial) {
    try {
        const response = await fetch(`/api/activos/search?serial=${encodeURIComponent(serial)}`);
        const activo = await response.json();

        if (response.ok && activo._id) {
            Swal.fire({
                title: '✅ Activo Encontrado',
                html: `
                    <strong>${activo.marca || 'Equipo'}</strong><br>
                    Serial: ${activo.serial}<br>
                    Estado: ${activo.estado}<br>
                    Área: ${activo.area || 'Sin asignar'}
                `,
                icon: 'success',
                confirmButtonText: 'Aceptar'
            });
        } else {
            Swal.fire('No encontrado', 'No existe un activo con ese código QR.', 'warning');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo buscar el activo en la base de datos.', 'error');
    }
};