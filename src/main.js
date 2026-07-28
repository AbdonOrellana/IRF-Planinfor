import { registerSW } from 'virtual:pwa-register';
import './offlineLogic.js';
import { Geolocation } from '@capacitor/geolocation';
import { Printer } from '@capgo/capacitor-printer';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const updateSW = registerSW({onNeedRefresh() {if (confirm('Nueva actualización disponible. ¿Recargar?')) {updateSW(true);}},onOfflineReady() {console.log('App is ready for offline use!');},});

import { trabajadoresMap, fundosData, fundosMap, peligrosMap } from "./data/appData.js";
window.trabajadoresMap = trabajadoresMap;
window.fundosData = fundosData;
window.fundosMap = fundosMap;
window.peligrosMap = peligrosMap;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function autoFillCargo() {
            const inputNombre = document.getElementById('nombre_participante');
            const inputCargo = document.getElementById('cargo_participante');
            if (inputNombre && inputCargo && trabajadoresMap[inputNombre.value]) {
                inputCargo.value = trabajadoresMap[inputNombre.value];
            }
        }

function initFundoAutocomplete() {
            const input = document.getElementById('fundo_instalacion');
            if (!input || typeof fundosMap === 'undefined') return;
            const data = Object.keys(fundosMap);

            input.classList.add('autocomplete-input');
            input.setAttribute('autocomplete', 'off');

            let wrapper = input.parentNode;
            if (!wrapper.classList.contains('autocomplete-wrapper')) {
                const newWrapper = document.createElement('div');
                newWrapper.classList.add('autocomplete-wrapper');
                wrapper.insertBefore(newWrapper, input);
                newWrapper.appendChild(input);
                wrapper = newWrapper;
            }

            let listContainer = document.createElement('div');
            listContainer.classList.add('autocomplete-items');
            wrapper.appendChild(listContainer);

            input.addEventListener('input', function () {
                let val = this.value;
                listContainer.innerHTML = '';
                if (!val) {
                    listContainer.style.display = 'none';
                    return;
                }

                let matches = data.filter(item => item.toLowerCase().includes(val.toLowerCase()));
                matches = matches.slice(0, 50);

                if (matches.length > 0) {
                    listContainer.style.display = 'block';
                    matches.forEach(match => {
                        let itemDiv = document.createElement('div');
                        itemDiv.classList.add('autocomplete-item');

                        const regex = new RegExp(`(${val})`, "gi");
                        const highlighted = match.replace(regex, "<strong>$1</strong>");

                        itemDiv.innerHTML = highlighted;

                        let areaSpan = document.createElement('span');
                        areaSpan.classList.add('autocomplete-item-cargo');
                        areaSpan.innerText = " - " + fundosMap[match];
                        itemDiv.appendChild(areaSpan);

                        itemDiv.addEventListener('mousedown', function (e) {
                            e.preventDefault();
                            input.value = match;
                            listContainer.style.display = 'none';
                            input.dispatchEvent(new Event('change'));
                        });
                        listContainer.appendChild(itemDiv);
                    });
                } else {
                    listContainer.style.display = 'none';
                }
            });

            input.addEventListener('blur', function () {
                listContainer.style.display = 'none';
            });

            input.addEventListener('focus', function () {
                if (this.value) {
                    input.dispatchEvent(new Event('input'));
                }
            });

            input.addEventListener('change', function () {
                const areaInput = document.getElementById('area_relacionamiento');
                if (areaInput && fundosMap[this.value]) {
                    areaInput.value = fundosMap[this.value];
                }
            });
        }

        function initPeligroSelect() {
            const select = document.getElementById('peligro_descripcion');
            if (!select || typeof peligrosMap === 'undefined') return;

            select.innerHTML = '<option value="">Seleccione un peligro o condición...</option>';

            for (let key in peligrosMap) {
                let opt = document.createElement('option');
                opt.value = key;
                opt.text = key;
                select.appendChild(opt);
            }

            select.addEventListener('change', function () {
                const container = document.getElementById('peligro_controles_container');
                const hiddenInput = document.getElementById('peligro_controles');
                
                const updateHiddenControles = () => {
                    if (!hiddenInput || !container) return;
                    const selected = Array.from(container.querySelectorAll('.chip-item.selected')).map(c => '\u2022 ' + c.dataset.value);
                    hiddenInput.value = selected.join('\n');
                    if (typeof checkStepCompletion === 'function') checkStepCompletion();
                };
                
                if (container) {
                    container.innerHTML = '';
                    if (this.value && peligrosMap[this.value]) {
                        let items = peligrosMap[this.value].split(', ');
                        items.forEach(item => {
                            const chip = document.createElement('div');
                            chip.className = 'chip-item';
                            chip.dataset.value = item;
                            chip.innerHTML = `<span class="chip-icon">\u2713</span><span>${item}</span>`;
                            // Default: NOT selected
                            chip.addEventListener('click', () => {
                                chip.classList.toggle('selected');
                                updateHiddenControles();
                            });
                            container.appendChild(chip);
                        });
                        if (hiddenInput) hiddenInput.value = '';
                    } else {
                        container.innerHTML = '<div style="font-size:13px; color:var(--text-muted); font-style:italic;">Seleccione un peligro para ver las medidas sugeridas.</div>';
                        if (hiddenInput) hiddenInput.value = '';
                    }
                }
                if (typeof checkStepCompletion === 'function') checkStepCompletion();
            });
        }



        function initCustomAutocomplete() {
            const inputs = document.querySelectorAll('input[list="trabajadores_list"]');
            if (typeof trabajadoresMap === 'undefined') return;
            const data = Object.keys(trabajadoresMap);

            inputs.forEach(input => {
                // Remove native list attribute
                input.removeAttribute('list');
                input.classList.add('autocomplete-input');
                input.setAttribute('autocomplete', 'off'); // Prevent browser autocomplete

                // Create wrapper if not exists
                let wrapper = input.parentNode;
                if (!wrapper.classList.contains('autocomplete-wrapper')) {
                    // We need to wrap the input but keep it in the DOM tree in the same place
                    const newWrapper = document.createElement('div');
                    newWrapper.classList.add('autocomplete-wrapper');
                    wrapper.insertBefore(newWrapper, input);
                    newWrapper.appendChild(input);
                    wrapper = newWrapper;
                }

                // Create dropdown container
                let listContainer = document.createElement('div');
                listContainer.classList.add('autocomplete-items');
                wrapper.appendChild(listContainer);

                input.addEventListener('input', function () {
                    let val = this.value;
                    listContainer.innerHTML = '';
                    if (!val) {
                        listContainer.style.display = 'none';
                        return;
                    }

                    let matches = data.filter(item => item.toLowerCase().includes(val.toLowerCase()));

                    if (matches.length > 0) {
                        listContainer.style.display = 'block';
                        matches.forEach(match => {
                            let itemDiv = document.createElement('div');
                            itemDiv.classList.add('autocomplete-item');

                            // Highlight match
                            const regex = new RegExp(`(${val})`, "gi");
                            const highlighted = match.replace(regex, "<strong>$1</strong>");

                            itemDiv.innerHTML = highlighted;

                            // Add secondary info (cargo)
                            let cargoSpan = document.createElement('span');
                            cargoSpan.classList.add('autocomplete-item-cargo');
                            cargoSpan.innerText = " - " + trabajadoresMap[match];
                            itemDiv.appendChild(cargoSpan);

                            itemDiv.addEventListener('mousedown', function (e) {
                                e.preventDefault(); // Prevent input blur
                                input.value = match;
                                listContainer.style.display = 'none';
                                // Trigger change event to fire checkStepCompletion
                                input.dispatchEvent(new Event('change'));
                                // Fire autoFillCargo manually if applicable
                                if (typeof autoFillCargo === 'function' && input.id === 'nombre_participante') {
                                    autoFillCargo();
                                }
                            });
                            listContainer.appendChild(itemDiv);
                        });
                    } else {
                        listContainer.style.display = 'none';
                    }
                });

                // Hide on blur
                input.addEventListener('blur', function () {
                    listContainer.style.display = 'none';
                });

                // Show on focus if has value
                input.addEventListener('focus', function () {
                    if (this.value) {
                        input.dispatchEvent(new Event('input'));
                    }
                });
            });
        }

        function initCustomSelects() {
            const selects = document.querySelectorAll('select');
            selects.forEach(select => {
                if (select.dataset.customized) return;
                select.dataset.customized = 'true';
                
                // Hide the original select
                select.style.display = 'none';
                
                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'custom-select-wrapper';
                select.parentNode.insertBefore(wrapper, select);
                wrapper.appendChild(select);
                
                // Create trigger
                const trigger = document.createElement('div');
                trigger.className = 'custom-select-trigger';
                
                const getSelectedText = () => {
                    const opt = select.options[select.selectedIndex];
                    return opt ? opt.text : 'Seleccionar...';
                };
                
                trigger.innerHTML = `<span>${getSelectedText()}</span>
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>`;
                wrapper.appendChild(trigger);
                
                // Create options container
                const optionsContainer = document.createElement('div');
                optionsContainer.className = 'custom-select-options';
                wrapper.appendChild(optionsContainer);
                
                const renderOptions = () => {
                    optionsContainer.innerHTML = '';
                    Array.from(select.options).forEach((opt, idx) => {
                        if (opt.disabled && opt.value === '') return; // skip placeholder if disabled
                        const div = document.createElement('div');
                        div.className = 'custom-option';
                        if (select.selectedIndex === idx) div.classList.add('selected');
                        div.innerText = opt.text;
                        div.addEventListener('click', (e) => {
                            e.stopPropagation();
                            select.selectedIndex = idx;
                            trigger.querySelector('span').innerText = opt.text;
                            optionsContainer.classList.remove('open');
                            trigger.classList.remove('open');
                            
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            select.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            optionsContainer.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                            div.classList.add('selected');
                        });
                        optionsContainer.appendChild(div);
                    });
                };
                
                renderOptions();
                
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = optionsContainer.classList.contains('open');
                    document.querySelectorAll('.custom-select-options').forEach(el => el.classList.remove('open'));
                    document.querySelectorAll('.custom-select-trigger').forEach(el => el.classList.remove('open'));
                    
                    if (!isOpen) {
                        renderOptions();
                        optionsContainer.classList.add('open');
                        trigger.classList.add('open');
                    }
                });
                
                select.addEventListener('change', () => {
                    trigger.querySelector('span').innerText = getSelectedText();
                });
            });
            
            document.addEventListener('click', () => {
                document.querySelectorAll('.custom-select-options').forEach(el => el.classList.remove('open'));
                document.querySelectorAll('.custom-select-trigger').forEach(el => el.classList.remove('open'));
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initCustomAutocomplete, 200);
            setTimeout(initFundoAutocomplete, 200);
            setTimeout(initPeligroSelect, 200);
            setTimeout(initCustomSelects, 250);
        });

// Data arrays for dynamic entries
        let participantesList = [];
        let peligrosList = [];

        // Simplified HTML5 Canvas Signature Pad Controller
        class SignaturePad {
            constructor(canvasId, inputId, wrapperId) {
                this.canvas = document.getElementById(canvasId);
                this.input = document.getElementById(inputId);
                this.wrapper = document.getElementById(wrapperId);
                this.ctx = this.canvas.getContext('2d');
                this.drawing = false;

                // Adaptive touch-resizing
                this.resize();
                window.addEventListener('resize', () => this.resize());

                // Brush values
                this.ctx.strokeStyle = '#3b82f6';
                this.ctx.lineWidth = 2.5;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';

                this.init();
            }

            resize() {
                const rect = this.canvas.getBoundingClientRect();
                if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
                    const temp = document.createElement('canvas');
                    temp.width = this.canvas.width;
                    temp.height = this.canvas.height;
                    const tempCtx = temp.getContext('2d');
                    tempCtx.drawImage(this.canvas, 0, 0);

                    this.canvas.width = rect.width;
                    this.canvas.height = rect.height;

                    this.ctx.strokeStyle = '#3b82f6';
                    this.ctx.lineWidth = 2.5;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';

                    this.ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, this.canvas.width, this.canvas.height);
                }
            }

            init() {
                // Mouse controls
                this.canvas.addEventListener('mousedown', (e) => this.start(e));
                this.canvas.addEventListener('mousemove', (e) => this.draw(e));
                this.canvas.addEventListener('mouseup', () => this.stop());
                this.canvas.addEventListener('mouseleave', () => this.stop());

                // Touch mobile finger controls
                this.canvas.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    const t = e.touches[0];
                    const me = new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY });
                    this.canvas.dispatchEvent(me);
                });
                this.canvas.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    const t = e.touches[0];
                    const me = new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY });
                    this.canvas.dispatchEvent(me);
                });
                this.canvas.addEventListener('touchend', () => {
                    const me = new MouseEvent('mouseup', {});
                    this.canvas.dispatchEvent(me);
                });
            }

            getPos(e) {
                const r = this.canvas.getBoundingClientRect();
                return {
                    x: e.clientX - r.left,
                    y: e.clientY - r.top
                };
            }

            start(e) {
                this.drawing = true;
                const pos = this.getPos(e);
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
                this.wrapper.classList.add('signed');
            }

            draw(e) {
                if (!this.drawing) return;
                const pos = this.getPos(e);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            }

            stop() {
                if (!this.drawing) return;
                this.drawing = false;
                this.save();
            }


            toggleFullscreen() {
                const box = this.wrapper.parentElement;
                const isFullscreen = box.classList.contains('fullscreen-modal');

                if (!isFullscreen) {
                    box.classList.add('fullscreen-modal');
                    box.style.position = 'fixed';
                    box.style.top = '0';
                    box.style.left = '0';
                    box.style.width = '100vw';
                    box.style.height = '100vh';
                    box.style.zIndex = '999999';
                    box.style.background = 'var(--bg-card)';
                    box.style.padding = '40px';
                    box.style.display = 'flex';
                    box.style.flexDirection = 'column';
                    this.wrapper.style.flexGrow = '1';
                    
                    if (box.requestFullscreen) {
                        box.requestFullscreen().then(() => {
                            if (screen.orientation && screen.orientation.lock) {
                                screen.orientation.lock('landscape').catch(e => console.log(e));
                            }
                        }).catch(e => console.log(e));
                    }
                    
                    setTimeout(() => this.resize(), 100);
                    showToast('Gire el dispositivo para firmar cómodamente', 'info');
                } else {
                    box.classList.remove('fullscreen-modal');
                    box.style.position = '';
                    box.style.top = '';
                    box.style.left = '';
                    box.style.width = '';
                    box.style.height = '';
                    box.style.zIndex = '';
                    box.style.background = '';
                    box.style.padding = '';
                    box.style.display = '';
                    box.style.flexDirection = '';
                    this.wrapper.style.flexGrow = '';
                    
                    if (document.fullscreenElement) {
                        document.exitFullscreen().then(() => {
                            if (screen.orientation && screen.orientation.unlock) {
                                screen.orientation.unlock();
                            }
                        }).catch(e => console.log(e));
                    }
                    
                    setTimeout(() => this.resize(), 100);
                }
            }

            clear() {
                this.drawing = false;
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.input.value = '';
                this.wrapper.classList.remove('signed');
                checkStepCompletion();
            }


            load(dataUrl) {
                if (dataUrl) {
                    const img = new Image();
                    img.onload = () => {
                        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                        this.wrapper.classList.add('signed');
                    };
                    img.src = dataUrl;
                    this.input.value = dataUrl;
                }
            }

            save() {
                if (!this.wrapper || !this.wrapper.classList.contains('signed')) {
                    this.input.value = '';
                } else {
                    try {
                        const cWidth = 350;
                        const cHeight = Math.round(350 * (this.canvas.height / (this.canvas.width || 1))) || 150;
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = cWidth;
                        tempCanvas.height = cHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(this.canvas, 0, 0, cWidth, cHeight);
                        this.input.value = tempCanvas.toDataURL('image/png');
                    } catch (e) {
                        this.input.value = this.canvas.toDataURL('image/png');
                    }
                }
                if (typeof checkStepCompletion === 'function') checkStepCompletion();
            }
        }

        let pad0, pad1, pad2, pad3, pad4;

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                // Restore styles when exiting
                document.querySelectorAll('.signature-box-mobile').forEach(box => {
                    box.style.background = '';
                    box.style.padding = '';
                    box.style.height = '';
                    box.style.display = '';
                    box.style.flexDirection = '';
                });
                document.querySelectorAll('.signature-canvas-area').forEach(wrapper => {
                    wrapper.style.flexGrow = '';
                });
                if (pad0) pad0.resize();
                if (pad1) pad1.resize();
                if (pad2) pad2.resize();
                if (pad3) pad3.resize();
                if (pad4) pad4.resize();
            }
        });


        document.addEventListener('DOMContentLoaded', () => {
            // Instantiate canvas components
            pad0 = new SignaturePad('firma_jefe_faena', 'firma_jefe_faena_input', 'wrapper-firma-0');
            pad1 = new SignaturePad('firma_asesor_prev_eess_intervencion', 'firma_asesor_prev_eess_intervencion_input', 'wrapper-firma-1');
            pad2 = new SignaturePad('firma_supervision_eess_intervencion', 'firma_supervision_eess_intervencion_input', 'wrapper-firma-2');
            pad3 = new SignaturePad('firma_asesor_prev_eess_recepcion', 'firma_asesor_prev_eess_recepcion_input', 'wrapper-firma-3');
            pad4 = new SignaturePad('firma_supervision_eess_recepcion', 'firma_supervision_eess_recepcion_input', 'wrapper-firma-4');
            
            window.pad0 = pad0;
            window.pad1 = pad1;
            window.pad2 = pad2;
            window.pad3 = pad3;
            window.pad4 = pad4;

            // Set today's date in local time for all date fields
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            if (document.getElementById('fecha_inicio')) {
                document.getElementById('fecha_inicio').value = todayStr;
            }
            if (document.getElementById('peligro_fecha')) {
                document.getElementById('peligro_fecha').value = todayStr;
            }
            if (document.getElementById('peligro_control_fecha')) {
                document.getElementById('peligro_control_fecha').value = todayStr;
            }

            // Listen to real-time form inputs validation updates
            document.querySelectorAll('#irf-form input, #irf-form select, #irf-form textarea').forEach(el => {
                el.addEventListener('input', checkStepCompletion);
                el.addEventListener('change', checkStepCompletion);
            });

            checkStepCompletion();
        });

        // Toggles expansion/collapse of Accordion cards
        function toggleAccordion(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
            const content = card.querySelector('.accordion-content');
            const isActive = card.classList.contains('active');

            if (isActive) {
                if (content) {
                    content.style.maxHeight = content.scrollHeight + "px";
                    content.style.overflow = "hidden";
                    void content.offsetWidth;
                    content.style.maxHeight = "0";
                }
                card.classList.remove('active');
            } else {
                card.classList.add('active');
                if (content) {
                    content.style.maxHeight = content.scrollHeight + "px";
                    setTimeout(() => {
                        if (card.classList.contains('active')) {
                            content.style.maxHeight = "none";
                            content.style.overflow = "visible";
                        }
                    }, 350);
                }

                setTimeout(() => {
                    if (cardId === 'card-step-4') {
                        const latVal = document.getElementById('latitud')?.value?.trim();
                        const lngVal = document.getElementById('longitud')?.value?.trim();
                        if (!latVal || !lngVal) {
                            getCurrentLocation();
                        }
                    }
                    if (cardId === 'card-step-6') {
                        if (typeof pad1 !== 'undefined' && pad1) pad1.resize();
                        if (typeof pad2 !== 'undefined' && pad2) pad2.resize();
                        if (typeof pad3 !== 'undefined' && pad3) pad3.resize();
                        if (typeof pad4 !== 'undefined' && pad4) pad4.resize();
                    }
                }, 300);
            }
        }


        // Slide emergency numbers modal toggler
        function toggleSosModal() {
            const modal = document.getElementById('sos-modal');
            const overlay = document.getElementById('sos-overlay');
            const isClosed = !modal.classList.contains('open');

            if (isClosed) {
                modal.classList.add('open');
                overlay.classList.add('open');
            } else {
                modal.classList.remove('open');
                overlay.classList.remove('open');
            }
        }

        // Theme Toggle controller
        function toggleTheme() {
            const cur = document.documentElement.getAttribute('data-theme');
            const target = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', target);
            localStorage.setItem('theme', target);
            showToast(`Tema ${target === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
        }

        // Initial theme loader
        (function () {
            const saved = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (saved === 'dark' || (!saved && prefersDark)) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
            }
        })();

        // Mobile Animated Toast Alerts
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            let icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            if (type === 'success') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            if (type === 'warning') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
            if (type === 'danger') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

            toast.innerHTML = `
                <span style="font-size: 15px;">${icon}</span>
                <div>${message}</div>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideInMobile 0.3s reverse forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }

        // Satellital Coordinates GPS auto-capture API (Web + Capacitor compatible)
        async function getCurrentLocation() {
            showToast('📍 Buscando señal GPS...', 'info');

            const setCoords = (lat, lng) => {
                const latEl = document.getElementById('latitud');
                const lngEl = document.getElementById('longitud');
                if (latEl) latEl.value = Number(lat).toFixed(6);
                if (lngEl) lngEl.value = Number(lng).toFixed(6);
                showToast('✅ GPS: Coordenadas fijadas con éxito.', 'success');
                if (typeof checkStepCompletion === 'function') checkStepCompletion();
            };

            // 1. Standard Web Browser Geolocation API
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setCoords(position.coords.latitude, position.coords.longitude);
                    },
                    async (error) => {
                        console.warn('Navigator Geolocation error, trying Capacitor fallback:', error);
                        // 2. Fallback to Capacitor Geolocation if available
                        try {
                            if (typeof Geolocation !== 'undefined' && Geolocation.getCurrentPosition) {
                                const pos = await Geolocation.getCurrentPosition({
                                    enableHighAccuracy: true,
                                    timeout: 15000
                                });
                                setCoords(pos.coords.latitude, pos.coords.longitude);
                                return;
                            }
                        } catch (capErr) {
                            console.error('Capacitor Geolocation error:', capErr);
                        }
                        
                        let msg = 'No se pudo obtener señal GPS.';
                        if (error.code === 1) msg = 'Permiso de GPS denegado por el dispositivo/navegador.';
                        else if (error.code === 2) msg = 'Señal GPS no disponible.';
                        else if (error.code === 3) msg = 'Tiempo de espera GPS agotado.';
                        
                        showToast(`⚠️ ${msg} Puede digitar las coordenadas manualmente.`, 'warning');
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 12000,
                        maximumAge: 0
                    }
                );
            } else {
                showToast('⚠️ El navegador no soporta geolocalización. Ingrese manualmente.', 'warning');
            }
        }

        // Real-time completeness check on accordion sections
        function checkStepCompletion() {
            for (let s = 1; s <= 6; s++) {
                let isComplete = false;
                let hasData = false;
                const statusBadge = document.getElementById(`status-step-${s}`);
                if (!statusBadge) continue;

                if (s === 1) {
                    const area = document.getElementById('area_relacionamiento').value.trim();
                    const faena = document.getElementById('estados_proyecto').value;
                    const fecha = document.getElementById('fecha_inicio').value;
                    const trab = document.getElementById('num_trabajadores').value;
                    const veh = document.getElementById('num_vehiculos').value;
                    const fundo = document.getElementById('fundo_instalacion').value.trim();

                    isComplete = !!(area && faena && fecha && trab && veh && fundo);
                    hasData = !!(area || faena || fecha || trab || veh || fundo);
                } else if (s === 2) {
                    const sup = document.getElementById('supervisor').value.trim();
                    const jefe = document.getElementById('jefe_faena').value.trim();
                    const clave = document.getElementById('clave_jefe_faena').value.trim();
                    const prev = document.getElementById('asesor_prev_riesgos').value.trim();
                    const tel = document.getElementById('telefono_jefe_faena').value.trim();

                    isComplete = !!(sup && jefe && clave && prev && tel);
                    hasData = !!(sup || jefe || clave || prev || tel);
                } else if (s === 3) {
                    isComplete = participantesList.length > 0;
                    hasData = participantesList.length > 0;
                } else if (s === 4) {
                    const lat = document.getElementById('latitud').value.trim();
                    const lng = document.getElementById('longitud').value.trim();

                    isComplete = !!(lat && lng);
                    hasData = !!(lat || lng);
                } else if (s === 5) {
                    isComplete = peligrosList.length > 0;
                    hasData = peligrosList.length > 0;
                } else if (s === 6) {
                    const f0 = document.getElementById('firma_jefe_faena_input').value;
                    const f1 = document.getElementById('firma_asesor_prev_eess_intervencion_input').value;
                    const f2 = document.getElementById('firma_supervision_eess_intervencion_input').value;
                    const f3 = document.getElementById('firma_asesor_prev_eess_recepcion_input').value;
                    const f4 = document.getElementById('firma_supervision_eess_recepcion_input').value;

                    isComplete = !!f0; // Solo Jefe de Faena es obligatorio
                    hasData = !!(f0 || f1 || f2 || f3 || f4);
                }

                if (isComplete) {
                    statusBadge.className = "status-badge status-complete";
                    statusBadge.innerText = "Listo";
                } else if (hasData) {
                    statusBadge.className = "status-badge status-incomplete";
                    statusBadge.innerText = "Pendiente";
                } else {
                    statusBadge.className = "status-badge status-empty";
                    statusBadge.innerText = "Vacío";
                }
            }



        }

        // ==========================================
        // DYNAMIC PARTICIPANTS CONTROLLER
        // ==========================================
        function agregarUsuario() {
            const nombreInput = document.getElementById('nombre_participante');
            const cargoInput = document.getElementById('cargo_participante');
            const nombreValue = nombreInput.value.trim();
            const cargoValue = cargoInput.value.trim();

            if (!nombreValue) {
                showToast('Por favor ingrese el nombre del participante.', 'warning');
                nombreInput.focus();
                return;
            }
            if (!cargoValue) {
                showToast('Por favor ingrese el cargo o rol.', 'warning');
                cargoInput.focus();
                return;
            }

            const nuevo = {
                nombre: nombreValue,
                cargo: cargoValue
            };
            participantesList.push(nuevo);

            nombreInput.value = '';
            cargoInput.value = '';

            actualizarTablaParticipantes();
            showToast('Participante registrado.', 'success');
            nombreInput.focus();
        }

        function eliminarUsuario(index) {
            participantesList.splice(index, 1);
            actualizarTablaParticipantes();
            showToast('Participante eliminado.', 'info');
        }

        function actualizarTablaParticipantes() {
            const cardContainer = document.getElementById('lista_participantes_container');
            const rawTableBody = document.getElementById('lista_participantes');
            const hiddenInput = document.getElementById('participantes_hidden');

            // Serialize
            hiddenInput.value = JSON.stringify(participantesList);

            if (participantesList.length === 0) {
                cardContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-light); font-style: italic; padding: 20px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%;">
                        No se han agregado participantes aún.
                    </div>
                `;
                rawTableBody.innerHTML = '';
            } else {
                let chipsHtml = '';
                let tableHtml = '';

                participantesList.forEach((p, index) => {
                    const initials = p.nombre.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').slice(0, 2).toUpperCase();

                    chipsHtml += `
                        <div class="participant-chip">
                            <div class="participant-chip-left">
                                <div class="participant-chip-avatar">${initials || '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'}</div>
                                <div class="participant-chip-details">
                                    <span class="participant-chip-name" title="${escapeHTML(p.nombre)}">${escapeHTML(p.nombre)}</span>
                                    <span class="participant-chip-role" title="${escapeHTML(p.cargo)}">${escapeHTML(p.cargo)}</span>
                                </div>
                            </div>
                            <button type="button" class="btn-chip-delete" onclick="eliminarUsuario(${index})" title="Eliminar participante">
                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        </div>
                    `;

                    tableHtml += `
                        <tr>
                            <td>${escapeHTML(p.nombre)}</td>
                            <td>${escapeHTML(p.cargo)}</td>
                            <td><button type="button" onclick="eliminarUsuario(${index})">Eliminar</button></td>
                        </tr>
                    `;
                });

                cardContainer.innerHTML = chipsHtml;
                rawTableBody.innerHTML = tableHtml;
            }

            checkStepCompletion();
        }

        // ==========================================
        // DYNAMIC HAZARDS / MATRIZ DE RIESGOS CONTROLLER
        // ==========================================
        function getRiskLevel(val) {
            if (val <= 0) return { text: 'MUY BAJO', class: 'risk-low' };
            if (val <= 3) return { text: 'MODERADO', class: 'risk-medium' };
            if (val <= 4) return { text: 'ALTO', class: 'risk-high' };
            if (val <= 6) return { text: 'MUY ALTO', class: 'risk-critical' };
            return { text: 'PÉRDIDA TOTAL', class: 'risk-disaster' };
        }

        function updateFirssoInicialUI() {
            const ifInput = document.getElementById('peligro_ini_if');
            const isInput = document.getElementById('peligro_ini_is');
            let ifVal = parseInt(ifInput.value) || 0;
            let isVal = parseInt(isInput.value) || 0;

            if (ifVal > 4) { ifVal = 4; ifInput.value = 4; }
            if (isVal > 4) { isVal = 4; isInput.value = 4; }
            if (ifVal < 0) { ifVal = 0; ifInput.value = 0; }
            if (isVal < 0) { isVal = 0; isInput.value = 0; }

            if (ifVal + isVal >= 8) {
                showToast("La sumatoria nunca puede ser 8. El valor máximo permitido es 7 o menor.", "danger");
                if (ifInput === document.activeElement) {
                    ifVal = 3;
                    ifInput.value = 3;
                } else {
                    isVal = 3;
                    isInput.value = 3;
                }
            }

            const firsso = ifVal + isVal;

            document.getElementById('val-ini-firsso').innerText = firsso;
            document.getElementById('peligro_ini_firsso').value = firsso;

            const banner = document.getElementById('banner-ini-risk');
            const lvl = getRiskLevel(firsso);

            banner.className = `threat-banner ${lvl.class}`;
            banner.innerHTML = `<span>Riesgo Inicial: <strong>${lvl.text}</strong></span>`;

            // Auto-populate residual inputs
            document.getElementById('peligro_res_if').value = document.getElementById('peligro_ini_if').value;
            document.getElementById('peligro_res_is').value = document.getElementById('peligro_ini_is').value;
            updateFirssoResidualUI();
        }

        function updateFirssoResidualUI() {
            const icVal = parseInt(document.getElementById('peligro_res_ic').value) || 0;
            const ifVal = parseInt(document.getElementById('peligro_res_if').value) || 0;
            const isVal = parseInt(document.getElementById('peligro_res_is').value) || 0;
            const firsso = (ifVal + isVal) - icVal;

            document.getElementById('val-res-firsso').innerText = firsso;
            document.getElementById('peligro_res_firsso').value = firsso;

            const banner = document.getElementById('banner-res-risk');
            const lvl = getRiskLevel(firsso);

            banner.className = `threat-banner ${lvl.class}`;
            banner.innerHTML = `<span>Riesgo Residual: <strong>${lvl.text}</strong></span>`;
        }

        function agregarPeligro() {
            const fechaInput = document.getElementById('peligro_fecha');
            const descInput = document.getElementById('peligro_descripcion');
            const locInput = document.getElementById('peligro_localizacion');
            const expInput = document.getElementById('peligro_expuestos');
            const iniIfInput = document.getElementById('peligro_ini_if');
            const iniIsInput = document.getElementById('peligro_ini_is');
            const iniFirssoInput = document.getElementById('peligro_ini_firsso');
            const contInput = document.getElementById('peligro_controles');
            const resIcInput = document.getElementById('peligro_res_ic');
            const resIfInput = document.getElementById('peligro_res_if');
            const resIsInput = document.getElementById('peligro_res_is');
            const resFirssoInput = document.getElementById('peligro_res_firsso');
            const respInput = document.getElementById('peligro_responsables');
            const estSelect = document.getElementById('peligro_estado');
            const ctrlFechaInput = document.getElementById('peligro_control_fecha');
            const firmaInput = document.getElementById('peligro_firma_sup');

            const descValue = descInput.value.trim();
            const locValue = locInput.value.trim();

            if (!fechaInput.value) {
                showToast('Por favor ingrese la fecha del peligro.', 'warning');
                fechaInput.focus();
                return;
            }
            if (!descValue) {
                showToast('Por favor describa la condición de riesgo.', 'warning');
                descInput.focus();
                return;
            }
            if (!locValue) {
                showToast('Por favor especifique la localización.', 'warning');
                locInput.focus();
                return;
            }
            if (!estSelect.value) {
                showToast('Por favor seleccione el estado.', 'warning');
                estSelect.focus();
                return;
            }
            if (!ctrlFechaInput.value) {
                showToast('Por favor ingrese la fecha de implementación.', 'warning');
                ctrlFechaInput.focus();
                return;
            }

            const processSave = (fotoBase64) => {
                const nuevo = {
                    fecha: fechaInput.value,
                    descripcion: descValue,
                    localizacion: locValue,
                    expuestos: expInput.value.trim(),
                    ini_if: parseInt(iniIfInput.value) || 0,
                    ini_is: parseInt(iniIsInput.value) || 0,
                    ini_firsso: parseInt(iniFirssoInput.value) || 0,
                    controles: contInput.value.trim(),
                    res_ic: parseInt(resIcInput.value) || 0,
                    res_if: parseInt(resIfInput.value) || 0,
                    res_is: parseInt(resIsInput.value) || 0,
                    res_firsso: parseInt(resFirssoInput.value) || 0,
                    responsables: respInput.value.trim(),
                    estado: estSelect.value,
                    control_fecha: ctrlFechaInput.value,
                    firma_sup: firmaInput.value.trim(),
                    fotoBase64: fotoBase64
                };

                peligrosList.push(nuevo);

                // Clean
                fechaInput.value = '';
                descInput.value = '';
                locInput.value = '';
                expInput.value = '';
                iniIfInput.value = '';
                iniIsInput.value = '';
                iniFirssoInput.value = '0';
                contInput.value = '';
                resIcInput.value = '';
                resIfInput.value = '';
                resIsInput.value = '';
                resFirssoInput.value = '0';
                respInput.value = '';
                estSelect.value = 'I';
                ctrlFechaInput.value = '';
                firmaInput.value = '';
                
                const contContainer = document.getElementById('peligro_controles_container');
                if (contContainer) {
                    contContainer.innerHTML = '<div style="font-size:13px; color:var(--text-muted); font-style:italic;">Seleccione un peligro para ver las medidas sugeridas.</div>';
                    contContainer.className = 'chip-list-container';
                }
                
                const fotoInput = document.getElementById('peligro_foto_base64');
                if (fotoInput) fotoInput.value = '';
                const fotoLabel = document.getElementById('peligro_foto_label');
                const fotoBtn = document.getElementById('peligro_foto_btn');
                if (fotoLabel) fotoLabel.innerText = 'Tomar Foto';
                if (fotoBtn) fotoBtn.classList.remove('file-selected');

                updateFirssoInicialUI();
                updateFirssoResidualUI();

                actualizarTablaPeligros();
                showToast('Registro de peligro guardado.', 'success');
                descInput.focus();
            };

            const fotoInput = document.getElementById('peligro_foto_base64');
            if (fotoInput && fotoInput.value) {
                processSave(fotoInput.value);
            } else {
                processSave(null);
            }
        }

        function eliminarPeligro(index) {
            peligrosList.splice(index, 1);
            actualizarTablaPeligros();
            showToast('Peligro eliminado.', 'info');
        }

        function actualizarTablaPeligros() {
            const mobileContainer = document.getElementById('hazards-mobile-list');
            const desktopTableBody = document.getElementById('lista_peligros');
            const hiddenInput = document.getElementById('peligros_hidden');

            hiddenInput.value = JSON.stringify(peligrosList);

            if (peligrosList.length === 0) {
                mobileContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-light); font-style: italic; padding: 20px; border: 1px dashed var(--border); border-radius: var(--radius-sm); width: 100%;">
                        No se han registrado peligros aún.
                    </div>
                `;
                desktopTableBody.innerHTML = `
                    <tr id="empty_peligros_row">
                        <td colspan="17" style="text-align: center; color: var(--text-light); font-style: italic; padding: 25px;">
                            No se han registrado peligros aún.
                        </td>
                    </tr>
                `;
            } else {
                let mobileHtml = '';
                let desktopHtml = '';

                peligrosList.forEach((p, index) => {
                    const iniLvl = getRiskLevel(p.ini_firsso);
                    const resLvl = getRiskLevel(p.res_firsso);
                    const stateText = p.estado === 'I' ? 'Implementado' : 'Pendiente';
                    const stateClass = p.estado === 'I' ? 'risk-low' : 'risk-high';

                    // 1. Mobile touch stacked card
                    mobileHtml += `
                        <div class="hazard-mobile-card ${resLvl.class}">
                            <div class="hazard-card-row">
                                <span class="hazard-card-date" style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> ${escapeHTML(p.fecha)}</span>
                                <span class="hazard-card-place" style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${escapeHTML(p.localizacion)}</span>
                            </div>
                            <div class="hazard-card-desc">${escapeHTML(p.descripcion)}</div>
                            ${p.fotoBase64 ? `<img src="${p.fotoBase64}" class="anexo-img-mobile" alt="Evidencia">` : ''}
                            <div style="font-size: 12px; color: var(--text-muted);"><strong>Expuestos:</strong> ${escapeHTML(p.expuestos || 'Ninguno')}</div>
                            <div class="hazard-card-firsso-block">
                                <span class="status-badge ${iniLvl.class}">Inicial: ${p.ini_firsso}</span>
                                <span class="status-badge ${resLvl.class}">Residual: ${p.res_firsso}</span>
                            </div>
                            ${p.controles ? `<div class="hazard-card-controls"><strong>Mitigación:</strong> ${escapeHTML(p.controles)}</div>` : ''}
                            <div class="hazard-card-row" style="margin-top: 4px; align-items: center;">
                                <div class="hazard-card-followup">
                                    <span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> ${escapeHTML(p.responsables || 'Sin asignar')}</span>
                                    <span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${escapeHTML(p.control_fecha || 'S/D')}</span>
                                </div>
                                <span class="status-badge ${stateClass}">${stateText}</span>
                            </div>
                            <button type="button" class="btn-hazard-delete" onclick="eliminarPeligro(${index})">
                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                Eliminar Registro
                            </button>
                        </div>
                    `;

                    // 2. Desktop/Print complete high density table row
                    desktopHtml += `
                        <tr>
                            <td>${escapeHTML(p.fecha)}</td>
                            <td style="white-space: normal; min-width: 150px; font-weight: 700; color: var(--text-heading);">${escapeHTML(p.descripcion)}</td>
                            <td>${escapeHTML(p.localizacion)}</td>
                            <td>${escapeHTML(p.expuestos)}</td>
                            <td style="text-align: center;">${p.ini_if}</td>
                            <td style="text-align: center;">${p.ini_is}</td>
                            <td class="tbl-firsso-cell">
                                <span class="risk-badge ${iniLvl.class}" style="font-size: 10px; padding: 2px 6px;">${p.ini_firsso}</span>
                            </td>
                            <td style="white-space: normal; min-width: 150px;">${escapeHTML(p.controles)}</td>
                            <td style="text-align: center;">${p.res_ic}</td>
                            <td style="text-align: center;">${p.res_if}</td>
                            <td style="text-align: center;">${p.res_is}</td>
                            <td class="tbl-firsso-cell">
                                <span class="risk-badge ${resLvl.class}" style="font-size: 10px; padding: 2px 6px;">${p.res_firsso}</span>
                            </td>
                            <td>${escapeHTML(p.responsables)}</td>
                            <td style="text-align: center;">
                                <span class="risk-badge ${stateClass}" style="font-size: 10px; padding: 2px 6px;">${stateText}</span>
                            </td>
                            <td>${escapeHTML(p.control_fecha)}</td>
                            <td>${escapeHTML(p.firma_sup)}</td>
                            <td style="text-align: center; vertical-align: middle;">
                                <button type="button" class="btn-chip-delete" onclick="eliminarPeligro(${index})" style="color: var(--danger);">
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `;
                });

                mobileContainer.innerHTML = mobileHtml;
                desktopTableBody.innerHTML = desktopHtml;
            }

            checkStepCompletion();
        }

        // ==========================================
        window.exportarAPdf = function() {
            // Validate pending participant data
            const nomPart = document.getElementById('nombre_participante');
            const cargoPart = document.getElementById('cargo_participante');
            if ((nomPart && nomPart.value.trim() !== '') || (cargoPart && cargoPart.value.trim() !== '')) {
                showToast('Tiene datos de un Participante sin agregar. Presione "Agregar Participante" primero.', 'warning');
                const card = document.getElementById('card-step-3');
                if (card && !card.classList.contains('active')) toggleAccordion('card-step-3');
                nomPart.focus();
                return;
            }

            // Validate at least one participant exists
            if (typeof participantesList === 'undefined' || participantesList.length === 0) {
                showToast('Debe agregar al menos un Participante en el Paso 3.', 'warning');
                const card = document.getElementById('card-step-3');
                if (card && !card.classList.contains('active')) toggleAccordion('card-step-3');
                return;
            }

            // Validate pending hazard data
            const pelDesc = document.getElementById('peligro_descripcion');
            if (pelDesc && pelDesc.value.trim() !== '') {
                showToast('Tiene un Peligro escrito sin guardar. Presione "Guardar Registro de Peligro" primero.', 'warning');
                const card = document.getElementById('card-step-5');
                if (card && !card.classList.contains('active')) toggleAccordion('card-step-5');
                pelDesc.focus();
                return;
            }

            // Validate at least one hazard exists
            if (typeof peligrosList === 'undefined' || peligrosList.length === 0) {
                showToast('Debe registrar al menos un Peligro en el Paso 5.', 'warning');
                const card = document.getElementById('card-step-5');
                if (card && !card.classList.contains('active')) toggleAccordion('card-step-5');
                return;
            }

            showToast('Preparando formato PDF...', 'info');

            // Remove previous replica if any
            const prevContainer = document.getElementById('pdf-replica-container');
            if (prevContainer) prevContainer.remove();

            // Gather inputs
            const gerencia = document.getElementById('gerencia').value;
            const area = document.getElementById('area_relacionamiento').value;
            const faenaSelect = document.getElementById('estados_proyecto');
            const faena = faenaSelect.options[faenaSelect.selectedIndex]?.text || '';
            const fechaInicio = document.getElementById('fecha_inicio').value;
            const trabajadores = document.getElementById('num_trabajadores').value;
            const vehiculos = document.getElementById('num_vehiculos').value;
            const fundo = document.getElementById('fundo_instalacion').value;
            const eess = document.getElementById('nombre_eess').value;
            const supervisor = document.getElementById('supervisor').value;
            const jefe = document.getElementById('jefe_faena').value;
            const claveJefe = document.getElementById('clave_jefe_faena').value;
            const asesor = document.getElementById('asesor_prev_riesgos').value;
            const fonoJefe = document.getElementById('telefono_jefe_faena').value;
            const latitud = document.getElementById('latitud').value;
            const longitud = document.getElementById('longitud').value;

            // Generate current local date/time for signature verification
            const now = new Date();
            const yearStr = now.getFullYear();
            const monthStr = String(now.getMonth() + 1).padStart(2, '0');
            const dayStr = String(now.getDate()).padStart(2, '0');
            const hoursStr = String(now.getHours()).padStart(2, '0');
            const minutesStr = String(now.getMinutes()).padStart(2, '0');
            const currentDateTimeStr = `${dayStr}/${monthStr}/${yearStr} ${hoursStr}:${minutesStr}`;
            const todayDmaStr = `${dayStr}/${monthStr}/${yearStr}`;

            // Date formatting helper
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return dateStr;
            };

            // Signatures
            const sig0 = document.getElementById('firma_jefe_faena_input').value;
            const sig1 = document.getElementById('firma_asesor_prev_eess_intervencion_input').value;
            const sig2 = document.getElementById('firma_supervision_eess_intervencion_input').value;
            const sig3 = document.getElementById('firma_asesor_prev_eess_recepcion_input').value;
            const sig4 = document.getElementById('firma_supervision_eess_recepcion_input').value;

            // Generate HTML for participants
            let participantsHtml = '';
            for (let i = 0; i < 6; i++) {
                const part = participantesList[i] || { nombre: '', cargo: '' };
                participantsHtml += `
                    <tr>
                        <td style="border: 1px solid #000; padding: 2px; height: 16px; font-size: 8px;">${escapeHTML(part.nombre)}</td>
                        <td style="border: 1px solid #000; padding: 2px; height: 16px; font-size: 8px;">${escapeHTML(part.cargo)}</td>
                    </tr>
                `;
            }

            // Generate HTML for hazards
            let hazardsHtml = '';
            peligrosList.forEach(p => {
                const getRiskStyle = (lvl) => {
                    if (lvl === 'Bajo') return 'background-color: #d1fae5; color: #065f46; border: 1px solid #059669;';
                    if (lvl === 'Medio') return 'background-color: #fef3c7; color: #92400e; border: 1px solid #d97706;';
                    if (lvl === 'Alto') return 'background-color: #fee2e2; color: #991b1b; border: 1px solid #dc2626;';
                    return 'background-color: #fca5a5; color: #7f1d1d; border: 1px solid #b91c1c;';
                };

                hazardsHtml += `
                    <tr>
                        <td>${formatDate(p.fecha)}</td>
                        <td style="text-align: left; max-width: 150px; word-wrap: break-word;">${escapeHTML(p.descripcion)}</td>
                        <td>${escapeHTML(p.localizacion)}</td>
                        <td>${escapeHTML(p.expuestos)}</td>
                        <td>${p.ini_if}</td>
                        <td>${p.ini_is}</td>
                        <td>0</td>
                        <td style="${getRiskStyle(p.ini_firsso)} font-weight: bold; font-size: 7px; padding: 1px 3px; border-radius: 3px;">${p.ini_firsso}</td>
                        <td style="text-align: left; max-width: 150px; word-wrap: break-word;">${escapeHTML(p.controles)}</td>
                        <td>0</td>
                        <td>${p.res_if}</td>
                        <td>${p.res_is}</td>
                        <td style="${getRiskStyle(p.res_firsso)} font-weight: bold; font-size: 7px; padding: 1px 3px; border-radius: 3px;">${p.res_firsso}</td>
                        <td>${escapeHTML(p.responsables)}</td>
                        <td style="font-weight: bold;">${p.estado}</td>
                        <td>${formatDate(p.control_fecha)}</td>
                        <td>${escapeHTML(p.firma_sup)}</td>
                    </tr>
                `;
            });

            // Populate empty rows to match original spacing if list is short
            const minRows = 10;
            if (peligrosList.length < minRows) {
                const remaining = minRows - peligrosList.length;
                for (let i = 0; i < remaining; i++) {
                    hazardsHtml += `
                        <tr style="height: 18px;">
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                        </tr>
                    `;
                }
            }

            // Generate Anexo Fotografico HTML
            let anexoHtml = '';
            let hasPhotos = false;
            peligrosList.forEach((p, idx) => {
                if (p.fotoBase64) {
                    hasPhotos = true;
                    anexoHtml += `
                        <div class="anexo-item">
                            <p><strong>Peligro N°${idx + 1}:</strong> ${escapeHTML(p.descripcion)}</p>
                            <p><strong>Localización:</strong> ${escapeHTML(p.localizacion)}</p>
                            <img src="${p.fotoBase64}" alt="Evidencia Fotográfica" />
                        </div>
                    `;
                }
            });

            let anexoSection = '';
            if (hasPhotos) {
                anexoSection = `
                    <div class="anexo-fotografico">
                        <h2>ANEXO FOTOGRÁFICO</h2>
                        ${anexoHtml}
                    </div>
                `;
            }

            const replica = document.createElement('div');
            replica.id = 'pdf-replica-container';
            replica.className = 'pdf-replica-container';
            replica.innerHTML = `
                <table style="width: 100%; border: none; margin-bottom: 5px;">
                    <tr>
                        <td style="font-size: 8px; line-height: 1.2; width: 30%; border: none;">
                            ELAB.: G.JAQUE<br>
                            REV.: K.SWENNOSEN<br>
                            APROB.: J.FLORES
                        </td>
                        <td style="text-align: center; font-weight: bold; font-size: 11px; width: 45%; border: none;">
                            DETERMINACION DE PELIGROS FORMULARIOS/REGISTROS : FORMATO PARA INTERVENCIÓN Y RIESGOS EN FAENAS (IRF)
                        </td>
                        <td style="font-size: 8px; line-height: 1.2; text-align: right; width: 25%; border: none;">
                            VERSION 17<br>
                            ${todayDmaStr}
                        </td>
                    </tr>
                </table>

                <div style="border-bottom: 2px solid #000; font-weight: bold; font-size: 12px; margin-bottom: 10px; padding-bottom: 3px;">
                    INTERVENCIÓN Y RIESGOS DE FAENAS (IRF)
                    <span style="float: right;">Hoja N°1</span>
                </div>

                <table class="pdf-info-table">
                    <tr>
                        <td colspan="2" class="pdf-cell-title" style="width: 38%;">Antecedentes de la Faena e Intervención:</td>
                        <td class="pdf-cell-title" style="width: 32%;">Antecedentes de EESS:</td>
                        <td colspan="2" class="pdf-cell-title" style="width: 30%;">Participantes en IRF:</td>
                    </tr>
                    <tr>
                        <td style="width: 12%;"><strong>Gerencia:</strong></td><td>${escapeHTML(gerencia)}</td>
                        <td rowspan="2"><strong>Nombre EESS:</strong> ${escapeHTML(eess)}</td>
                        <td class="pdf-cell-title" style="text-align: center; font-size: 7px; width: 18%; padding: 2px;">Nombre</td>
                        <td class="pdf-cell-title" style="text-align: center; font-size: 7px; width: 12%; padding: 2px;">Cargo</td>
                    </tr>
                    <tr>
                        <td><strong>Área Relac.:</strong></td><td>${escapeHTML(area)}</td>
                        <td colspan="2" rowspan="6" style="padding: 0; vertical-align: top;">
                            <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                                ${participantsHtml}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Faena:</strong></td><td>${escapeHTML(faena)}</td>
                        <td><strong>Supervisor:</strong> ${escapeHTML(supervisor)}</td>
                    </tr>
                    <tr>
                        <td><strong>Fecha Inicio:</strong></td><td>${formatDate(fechaInicio)}</td>
                        <td><strong>Jefe de Faena:</strong> ${escapeHTML(jefe)}</td>
                    </tr>
                    <tr>
                        <td><strong>Trabajadores:</strong></td><td>${escapeHTML(trabajadores)}</td>
                        <td><strong>Clave Jefe Faena:</strong> ${escapeHTML(claveJefe)}</td>
                    </tr>
                    <tr>
                        <td><strong>Vehículos:</strong></td><td>${escapeHTML(vehiculos)}</td>
                        <td><strong>Asesor Prevención:</strong> ${escapeHTML(asesor)}</td>
                    </tr>
                    <tr>
                        <td><strong>Fundo/Instalación:</strong></td><td>${escapeHTML(fundo)}</td>
                        <td style="font-size: 7px; line-height: 1.2; padding: 2px;">
                            Fono Denuncia : 09-94425100<br>
                            Central DAC : 043-2636281 &nbsp;&nbsp; Incendios : 800441000<br>
                            Teléfono Jefe de Faena : ${escapeHTML(fonoJefe)}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="5" style="background-color: #f9f9f9; padding: 3px;">
                            <strong>COORDENADAS CASO RESCATE (Datum 84)</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                            <strong>Latitud:</strong> ${escapeHTML(latitud)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
                            <strong>Longitud:</strong> ${escapeHTML(longitud)}
                        </td>
                    </tr>
                </table>

                <div style="font-weight: bold; font-size: 8px; margin-top: 5px; margin-bottom: 3px;">
                    IDENTIFICACION DE PELIGRO Y EVALUACION DE RIESGOS <br>
                    <span style="font-weight: normal; font-size: 7px; color: #555;">Temas relevantes : Seguridad, Medio Ambiente, Prevención Incendios, Faenas Especiales y Aviso a Vecinos.</span>
                </div>

                <table class="pdf-hazards-table">
                    <thead>
                        <tr>
                            <th rowspan="2" style="width: 6%;">FECHA</th>
                            <th rowspan="2">Descripción del Peligro (Acción o Condición Insegura)</th>
                            <th rowspan="2" style="width: 10%;">Localización del Peligro (Fundo/ Lugar)</th>
                            <th rowspan="2" style="width: 10%;">EXPUESTOS (Persona/Equipo en contacto)</th>
                            <th colspan="4" style="font-size: 7px; padding: 2px;">EVALUACIÓN INICIAL</th>
                            <th rowspan="2">TIPO DE CONTROLES</th>
                            <th colspan="4" style="font-size: 7px; padding: 2px;">EVALUACIÓN RESIDUAL</th>
                            <th rowspan="2" style="width: 10%;">RESPONSABLES</th>
                            <th rowspan="2" style="width: 8%;">ESTADO</th>
                            <th rowspan="2" style="width: 8%;">FECHA<br>(implementación)</th>
                            <th rowspan="2" style="width: 8%;">FIRMA SUP.</th>
                        </tr>
                        <tr>
                            <th>IF</th><th>IS</th><th>IC</th><th>FIRSSO</th>
                            <th>IF</th><th>IS</th><th>IC</th><th>FIRSSO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hazardsHtml}
                    </tbody>
                </table>

                <div style="margin-top: 8px; border: 1px solid #000; padding: 3px;">
                    <div style="font-weight: bold; font-size: 8px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 3px;">
                        V°B° INTERVENCIÓN Y CIERRE
                    </div>
                    <table style="width: 100%; border: none; font-size: 7px; margin: 0;">
                        <tr>
                            <td style="width: 50%; border-right: 1px solid #000; border-top: none; border-bottom: none; border-left: none; padding-right: 10px; vertical-align: top;">
                                <strong>V°B° INTERVENCIÓN</strong><br><br>
                                <table style="width: 100%; border: none;">
                                    <tr>
                                        <td style="width: 33%; border: none; text-align: center; padding: 0;">
                                            ${sig0 ? `<img src="${sig0}" style="max-height: 30px; display: block; margin: 0 auto;"><div style="font-size: 6px; font-weight: normal; margin-top: 2px; color: #333;">${currentDateTimeStr}</div>` : '<div style="height: 30px;"></div>'}
                                            <div style="border-top: 1px solid #000; padding-top: 1px; font-size: 7px;">JEFE DE FAENA</div>
                                        </td>
                                        <td style="width: 33%; border: none; text-align: center; padding: 0;">
                                            ${sig1 ? `<img src="${sig1}" style="max-height: 30px; display: block; margin: 0 auto;"><div style="font-size: 6px; font-weight: normal; margin-top: 2px; color: #333;">${currentDateTimeStr}</div>` : '<div style="height: 30px;"></div>'}
                                            <div style="border-top: 1px solid #000; padding-top: 1px; font-size: 7px;">ASESOR PREV. EESS</div>
                                        </td>
                                        <td style="width: 33%; border: none; text-align: center; padding: 0;">
                                            ${sig2 ? `<img src="${sig2}" style="max-height: 30px; display: block; margin: 0 auto;"><div style="font-size: 6px; font-weight: normal; margin-top: 2px; color: #333;">${currentDateTimeStr}</div>` : '<div style="height: 30px;"></div>'}
                                            <div style="border-top: 1px solid #000; padding-top: 1px; font-size: 7px;">SUPERVISIÓN EESS</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td style="width: 50%; border: none; padding-left: 10px; vertical-align: top;">
                                <strong>V°B° RECEPCIÓN</strong><br><br>
                                <table style="width: 100%; border: none;">
                                    <tr>
                                        <td style="width: 50%; border: none; text-align: center; padding: 0;">
                                            ${sig3 ? `<img src="${sig3}" style="max-height: 30px; display: block; margin: 0 auto;"><div style="font-size: 6px; font-weight: normal; margin-top: 2px; color: #333;">${currentDateTimeStr}</div>` : '<div style="height: 30px;"></div>'}
                                            <div style="border-top: 1px solid #000; padding-top: 1px; font-size: 7px;">ASESOR PREV. EESS</div>
                                        </td>
                                        <td style="width: 50%; border: none; text-align: center; padding: 0;">
                                            ${sig4 ? `<img src="${sig4}" style="max-height: 30px; display: block; margin: 0 auto;"><div style="font-size: 6px; font-weight: normal; margin-top: 2px; color: #333;">${currentDateTimeStr}</div>` : '<div style="height: 30px;"></div>'}
                                            <div style="border-top: 1px solid #000; padding-top: 1px; font-size: 7px;">SUPERVISIÓN EESS</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 5px; font-size: 6px; line-height: 1.2; color: #555; text-align: justify;">
                    <strong>NOTA:</strong> Independiente de la fecha y responsables asignados en el presente documento; será responsabilidad de la Empresa de Servicios tomar todas las medidas necesarias para mantener bajo control las condiciones de riesgo detectadas durante el período que dure el proceso de implementación, al igual que la capacitación a los trabajadores acerca de los peligros identificados.
                </div>

                ${anexoSection}
            `;

            document.body.appendChild(replica);

            showToast('Preparando impresión...', 'info');

            // Printer.printWebView() uses Android PrintManager natively
            // Android PrintManager opens with full CSS @media print styling (identical to original HTML)
            setTimeout(async () => {
                try {
                    const fileName = `IRF_${new Date().toISOString().slice(0,10)}`;
                    await Printer.printWebView({ name: fileName });
                    showToast('✅ Selecciona "Guardar como PDF" en la vista previa.', 'success');
                } catch(e) {
                    console.error(e);
                    showToast('Error: ' + e.message, 'danger');
                }
            }, 300);
        }


// Auto-Save Feature
        function saveDraft() {
            const draft = {
                inputs: {},
                participantes: typeof participantesList !== 'undefined' ? participantesList : [],
                peligros: typeof peligrosList !== 'undefined' ? peligrosList : []
            };

            document.querySelectorAll('#irf-form input, #irf-form select, #irf-form textarea').forEach(el => {
                if (el.id && el.type !== 'file') {
                    draft.inputs[el.id] = el.value;
                }
            });

            localStorage.setItem('irf_autosave', JSON.stringify(draft));
        }

        function loadDraft() {
            const saved = localStorage.getItem('irf_autosave');
            if (!saved) return;

            try {
                const draft = JSON.parse(saved);

                // Restore standard inputs
                for (const [id, value] of Object.entries(draft.inputs)) {
                    const el = document.getElementById(id);
                    if (el && el.type !== 'file') {
                        el.value = value;
                        // If it's a signature, draw it
                        if (id === 'firma_jefe_faena_input' && typeof pad0 !== 'undefined') pad0.load(value);
                        if (id === 'firma_asesor_prev_eess_intervencion_input' && typeof pad1 !== 'undefined') pad1.load(value);
                        if (id === 'firma_supervision_eess_intervencion_input' && typeof pad2 !== 'undefined') pad2.load(value);
                        if (id === 'firma_asesor_prev_eess_recepcion_input' && typeof pad3 !== 'undefined') pad3.load(value);
                        if (id === 'firma_supervision_eess_recepcion_input' && typeof pad4 !== 'undefined') pad4.load(value);
                    }
                }

                // Restore dynamic lists
                if (draft.participantes && typeof participantesList !== 'undefined') {
                    participantesList = draft.participantes;
                    if (typeof actualizarTablaParticipantes === 'function') actualizarTablaParticipantes();
                }
                if (draft.peligros && typeof peligrosList !== 'undefined') {
                    peligrosList = draft.peligros;
                    if (typeof actualizarTablaPeligros === 'function') actualizarTablaPeligros();
                    if (typeof updateFirssoInicialUI === 'function') updateFirssoInicialUI();
                }

                // Trigger completion check
                if (typeof checkStepCompletion === 'function') checkStepCompletion();

                showToast('Borrador recuperado con éxito.', 'success');
            } catch (e) {
                console.error('Error loading draft', e);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                loadDraft();

                const fotoBtn = document.getElementById('peligro_foto_btn');
                if (fotoBtn) {
                    fotoBtn.addEventListener('click', async function(e) {
                        e.preventDefault();
                        try {
                            const image = await Camera.getPhoto({
                                quality: 70,
                                allowEditing: false,
                                resultType: CameraResultType.DataUrl,
                                source: CameraSource.Camera
                            });
                            
                            const hiddenInput = document.getElementById('peligro_foto_base64');
                            if (hiddenInput) hiddenInput.value = image.dataUrl;
                            
                            const label = document.getElementById('peligro_foto_label');
                            if (label) label.innerText = '¡Foto Capturada!';
                            fotoBtn.classList.add('file-selected');
                            showToast('Foto agregada correctamente', 'success');
                        } catch (err) {
                            console.error('Error con la cámara:', err);
                            // User might cancel
                        }
                    });
                }

                document.querySelectorAll('#irf-form input, #irf-form select, #irf-form textarea').forEach(el => {
                    el.addEventListener('input', saveDraft);
                    el.addEventListener('change', saveDraft);
                });

                document.body.addEventListener('click', () => {
                    setTimeout(saveDraft, 100);
                });

            }, 400);
        });

document.addEventListener('DOMContentLoaded', () => {
            const fundoInput = document.getElementById('fundo_instalacion');
            const areaInput = document.getElementById('area_relacionamiento');
            if (fundoInput && areaInput) {
                fundoInput.addEventListener('input', () => {
                    const num = fundoInput.value.trim();
                    if (fundosMap[num]) {
                        areaInput.value = fundosMap[num];
                        if (typeof checkStepCompletion === 'function') checkStepCompletion();
                    }
                });
            }
        });
        // Toggles expansion/collapse of Accordion cards
        function DUP_toggleAccordion(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
            const isActive = card.classList.contains('active');

            // Toggle clicked card
            if (isActive) {
                card.classList.remove('active');
            } else {
                card.classList.add('active');

                // Wait for expand visual, then trigger signature resizing safely
                setTimeout(() => {
                    if (cardId === 'card-step-6') {
                        if (typeof pad1 !== 'undefined' && pad1) pad1.resize();
                        if (typeof pad2 !== 'undefined' && pad2) pad2.resize();
                        if (typeof pad3 !== 'undefined' && pad3) pad3.resize();
                        if (typeof pad4 !== 'undefined' && pad4) pad4.resize();
                    }
                }, 300);
            }
        }

        // Slide emergency numbers modal toggler
        function DUP_toggleSosModal() {
            const modal = document.getElementById('sos-modal');
            const overlay = document.getElementById('sos-overlay');
            if (!modal || !overlay) return;
            const isClosed = !modal.classList.contains('open');

            if (isClosed) {
                modal.classList.add('open');
                overlay.classList.add('open');
            } else {
                modal.classList.remove('open');
                overlay.classList.remove('open');
            }
        }

        // =========================================================================
        // NATIVE ANDROID BRIDGE & OFFLINE SYSTEM INTEGRATION
        // =========================================================================
        let currentActiveFormId = null;
        // Detecta si la app corre dentro del contenedor Android Nativo
        const isAndroidApp = typeof window.Android !== 'undefined';

        function checkConnectionStatus() {
            if (!isAndroidApp) return;
            // Provide fallback if Android object doesn't have checkNetworkStatus
            const online = window.Android && window.Android.checkNetworkStatus ? window.Android.checkNetworkStatus() : navigator.onLine;
            const badge = document.getElementById('sync-connection-badge');
            const syncBtn = document.getElementById('btn-sync-all');

            if (online) {
                badge.className = "status-badge status-complete";
                badge.innerText = "🟢 Conectado";
                syncBtn.style.display = "block";
            } else {
                badge.className = "status-badge status-incomplete";
                badge.innerText = "🔴 Offline";
                syncBtn.style.display = "none";
            }
        }

        function verificarAccesoPlataforma() {
            const isCapacitorNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            const isAndroidApp = !!(window.Android || isCapacitorNative || window.location.search.includes('mode=app'));

            const mainTabs = document.querySelector('.main-tabs');
            const loginOverlay = document.getElementById('login-modal-overlay');
            const logoutBtn = document.getElementById('btn-logout');
            const logoutBtnHero = document.getElementById('btn-logout-hero');
            const headerPrintBtn = document.getElementById('btn-header-print');

            if (isAndroidApp) {
                // APK App: Ocultar vista prevencionista, pestaña principal no necesaria
                if (mainTabs) mainTabs.style.display = 'none';
                if (loginOverlay) loginOverlay.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
                if (logoutBtnHero) logoutBtnHero.style.display = 'none';
                switchMainTab('form');
            } else {
                // Vista Web: Exclusiva para Prevencionista (Sin acceso a crear IRF)
                if (mainTabs) mainTabs.style.display = 'none';
                if (headerPrintBtn) headerPrintBtn.style.display = 'none';
                const authToken = sessionStorage.getItem('irf_auth_token');
                if (!authToken) {
                    if (loginOverlay) loginOverlay.style.display = 'flex';
                    if (logoutBtn) logoutBtn.style.display = 'none';
                    if (logoutBtnHero) logoutBtnHero.style.display = 'none';
                } else {
                    if (loginOverlay) loginOverlay.style.display = 'none';
                    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
                    if (logoutBtnHero) logoutBtnHero.style.display = 'inline-flex';
                    switchMainTab('prevencionista');
                }
            }
        }

        async function procesarLogin(e) {
            if (e) e.preventDefault();
            const usernameInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');
            const errorMsg = document.getElementById('login-error-msg');
            const loginOverlay = document.getElementById('login-modal-overlay');
            const logoutBtn = document.getElementById('btn-logout');
            const logoutBtnHero = document.getElementById('btn-logout-hero');
            const mainTabs = document.querySelector('.main-tabs');

            const username = usernameInput?.value?.trim() || '';
            const password = passwordInput?.value?.trim() || '';

            if (errorMsg) errorMsg.style.display = 'none';

            function showLoggedInUI() {
                if (loginOverlay) loginOverlay.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-flex';
                if (logoutBtnHero) logoutBtnHero.style.display = 'inline-flex';
                if (mainTabs) mainTabs.style.display = 'none';
                showToast('✅ Sesión iniciada como Prevencionista', 'success');
                switchMainTab('prevencionista');
            }

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const json = await res.json();
                if (json.success && json.token) {
                    sessionStorage.setItem('irf_auth_token', json.token);
                    showLoggedInUI();
                    return;
                }
            } catch (err) {
                console.warn('API login fallback check:', err);
            }

            // Fallback validation if server offline or custom creds
            if ((username === 'prevencionista' || username === 'admin') && (password === 'admin' || password === 'mingeo2026')) {
                sessionStorage.setItem('irf_auth_token', 'token_local_' + Date.now());
                showLoggedInUI();
            } else {
                if (errorMsg) {
                    errorMsg.textContent = '❌ Usuario o contraseña incorrectos. (Prueba: prevencionista / admin)';
                    errorMsg.style.display = 'block';
                }
            }
        }

        function cerrarSesion() {
            sessionStorage.removeItem('irf_auth_token');
            const loginOverlay = document.getElementById('login-modal-overlay');
            const logoutBtn = document.getElementById('btn-logout');
            const logoutBtnHero = document.getElementById('btn-logout-hero');
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (logoutBtnHero) logoutBtnHero.style.display = 'none';
            document.body.classList.remove('prevencionista-mode');
            showToast('🔒 Sesión cerrada', 'info');
        }

        function initAndroidApp() {
            // Always show action buttons and dashboard (localStorage works in Capacitor)
            const dashboard = document.getElementById('offline-dashboard');
            const actionBtns = document.getElementById('mobile-action-buttons');
            if (dashboard) dashboard.style.display = 'block';
            if (actionBtns) actionBtns.style.display = 'grid';

            currentActiveFormId = 'irf_' + Date.now();
            renderSavedForms();
            verificarAccesoPlataforma();
        }

        document.addEventListener('DOMContentLoaded', () => {
            initAndroidApp();
        });

        // ------------------ LOGICA DE LA BANDEJA (localStorage) ------------------
        function getSavedFormsList() {
            const raw = localStorage.getItem('irf_forms_index');
            return raw ? JSON.parse(raw) : [];
        }

        function setSavedFormsList(list) {
            localStorage.setItem('irf_forms_index', JSON.stringify(list));
        }

        function renderSavedForms() {
            const container = document.getElementById('saved-forms-list');
            if (!container) return;
            const list = getSavedFormsList();

            if (!list || list.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 16px; border: 1px dashed var(--border); border-radius: var(--radius-sm); font-size:13px;">
                        No hay formularios guardados aún.
                    </div>
                `;
                return;
            }

            let html = '';
            list.slice().reverse().forEach(item => {
                const dateStr = new Date(item.savedAt).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                html += `
                    <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; margin-bottom:10px;">
                        <div style="font-weight:700; font-size:14px; color:var(--text-main); margin-bottom:2px;">${escapeHTML(item.nombre)}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">Guardado: ${dateStr}</div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" onclick="cargarFormulario('${item.id}')" style="flex:1; padding:8px; font-size:12px; font-weight:600; background:var(--primary); color:#fff; border:none; border-radius:var(--radius-sm); cursor:pointer;">📂 Cargar</button>
                            <button type="button" onclick="borrarFormulario('${item.id}')" style="padding:8px 12px; font-size:12px; font-weight:600; background:rgba(220,38,38,0.1); color:#dc2626; border:1px solid rgba(220,38,38,0.3); border-radius:var(--radius-sm); cursor:pointer;">🗑</button>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        }

        function getServerUrl() {
            return localStorage.getItem('irf_server_url') || 'http://services.planinfor.cl:8091';
        }

        function setServerUrl(url) {
            if (url) {
                let clean = url.trim().replace(/\/$/, '');
                if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                    clean = 'http://' + clean;
                }
                localStorage.setItem('irf_server_url', clean);
            }
        }

        function configurarServidorUrl() {
            const current = getServerUrl();
            const val = prompt('Configurar Dirección IP / URL del Servidor API (PC de producción):', current);
            if (val !== null && val.trim() !== '') {
                setServerUrl(val);
                showToast(`✅ Servidor configurado en: ${getServerUrl()}`, 'success');
            }
        }

        async function tryFetchWithFallback(endpoint, options = {}) {
            const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || !!window.Android;
            const configuredUrl = (getServerUrl() || 'http://services.planinfor.cl:8091').replace(/\/$/, '');

            const candidateUrls = [
                configuredUrl,
                'http://services.planinfor.cl:8091',
                'http://190.13.189.196:8091'
            ];

            const uniqueCandidates = [...new Set(candidateUrls)];
            let lastError = null;

            for (const baseUrl of uniqueCandidates) {
                const targetUrl = isNative ? (baseUrl + endpoint) : (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);

                try {
                    const res = await fetch(targetUrl, {
                        ...options,
                        signal: controller.signal,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(options.headers || {})
                        }
                    });
                    clearTimeout(timeoutId);
                    if (res.ok || res.status < 500) return res;
                } catch (err) {
                    clearTimeout(timeoutId);
                    lastError = err;
                    console.warn(`Intento fallido a ${targetUrl}:`, err);
                    if (!isNative) {
                        try {
                            const webRes = await fetch(baseUrl + endpoint, { ...options });
                            if (webRes.ok) return webRes;
                        } catch (e2) {
                            lastError = e2;
                        }
                    }
                }
            }

            throw lastError || new Error('No se pudo conectar a ningún servidor disponible');
        }

        async function sincronizarTodos(directFormObj) {
            showToast('Iniciando sincronización con el servidor...', 'info');
            let list = getSavedFormsList() || [];

            let itemsToSync = [];
            if (directFormObj && directFormObj.id) {
                itemsToSync.push({ itemRef: null, formObj: directFormObj });
            }

            for (const item of list) {
                if (directFormObj && directFormObj.id === item.id) continue;
                const raw = localStorage.getItem('irf_form_' + item.id);
                if (raw) {
                    try {
                        itemsToSync.push({ itemRef: item, formObj: JSON.parse(raw) });
                    } catch (e) {
                        console.warn('Error parsing form item', e);
                    }
                }
            }

            if (itemsToSync.length === 0) {
                showToast('No hay formularios guardados localmente para sincronizar', 'info');
                return;
            }

            let countSuccess = 0;
            let lastErrorMsg = '';

            for (const entry of itemsToSync) {
                try {
                    const response = await tryFetchWithFallback('/api/sync', {
                        method: 'POST',
                        body: JSON.stringify(entry.formObj)
                    });

                    if (response.ok) {
                        countSuccess++;
                        if (entry.itemRef) {
                            entry.itemRef.synced = true;
                            entry.itemRef.syncedAt = new Date().toISOString();
                        } else {
                            const idx = list.findIndex(l => l.id === entry.formObj.id);
                            if (idx >= 0) {
                                list[idx].synced = true;
                                list[idx].syncedAt = new Date().toISOString();
                            } else {
                                list.push({
                                    id: entry.formObj.id,
                                    nombre: entry.formObj.nombre,
                                    savedAt: entry.formObj.savedAt,
                                    synced: true,
                                    syncedAt: new Date().toISOString()
                                });
                            }
                        }
                    } else {
                        const errTxt = await response.text();
                        lastErrorMsg = `HTTP ${response.status}: ${errTxt}`;
                        console.error('Servidor retornó error al sincronizar ' + entry.formObj.id, errTxt);
                    }
                } catch (err) {
                    lastErrorMsg = err.message || String(err);
                    console.error('Error de red al sincronizar formulario ' + entry.formObj.id, err);
                }
            }

            try {
                setSavedFormsList(list);
                renderSavedForms();
            } catch (e) {
                console.warn('Error re-rendering saved forms list:', e);
            }

            if (countSuccess > 0) {
                showToast(`✅ Sincronizados con éxito: ${countSuccess} de ${itemsToSync.length} formularios en la base de datos.`, 'success');
                const prevContainer = document.getElementById('view-prevencionista-container');
                if (prevContainer && prevContainer.style.display !== 'none') {
                    cargarFormulariosPrevencionista();
                }
            } else {
                showToast(`⚠️ No se pudo sincronizar: ${lastErrorMsg || 'Error de conexión'}`, 'danger');
            }
        }

        // ------------------ MODULO VISTA PREVENCIONISTA ------------------
        let syncedFormsCache = [];

        function switchMainTab(tab) {
            const formTabBtn = document.getElementById('tab-btn-form');
            const prevTabBtn = document.getElementById('tab-btn-prevencionista');
            const formContainer = document.getElementById('view-form-container');
            const prevContainer = document.getElementById('view-prevencionista-container');

            if (tab === 'form') {
                if (formTabBtn) formTabBtn.classList.add('active');
                if (prevTabBtn) prevTabBtn.classList.remove('active');
                if (formContainer) formContainer.style.display = 'block';
                if (prevContainer) prevContainer.style.display = 'none';
                document.body.classList.remove('prevencionista-mode');
            } else if (tab === 'prevencionista') {
                if (formTabBtn) formTabBtn.classList.remove('active');
                if (prevTabBtn) prevTabBtn.classList.add('active');
                if (formContainer) formContainer.style.display = 'none';
                if (prevContainer) prevContainer.style.display = 'block';
                document.body.classList.add('prevencionista-mode');
                cargarFormulariosPrevencionista();
            }
        }

        async function cargarFormulariosPrevencionista() {
            const tbody = document.getElementById('prevencionista-table-body');
            const badge = document.getElementById('prev-db-badge');
            if (!tbody) return;

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">
                        🔄 Consultando registros en la base de datos...
                    </td>
                </tr>
            `;

            try {
                const response = await tryFetchWithFallback('/api/forms');
                if (!response.ok) throw new Error('Servidor retornó error HTTP ' + response.status);
                const json = await response.json();
                syncedFormsCache = (json.forms || []).filter(f => f && f.id);

                if (badge) {
                    badge.innerHTML = '<span class="prev-connection-dot"></span> Servidor Conectado';
                    badge.className = 'prev-connection-badge connected';
                }

                poblarOpcionesFiltrosPrevencionista(syncedFormsCache);
                filtrarTablaPrevencionista();
            } catch (err) {
                console.error('Error al obtener formularios de la BD:', err);
                if (badge) {
                    badge.innerHTML = '⚠ Sin Conexión';
                    badge.className = 'prev-connection-badge disconnected';
                }
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8">
                            <div class="prev-empty-state">
                                <div class="prev-empty-icon">⚠️</div>
                                <div class="prev-empty-text">
                                    No se pudo conectar con el servidor.<br>
                                    Verifica que la API esté activa e intenta nuevamente.
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        function poblarOpcionesFiltrosPrevencionista(forms) {
            const fundoSelect = document.getElementById('prev-filter-fundo');
            const supervisorSelect = document.getElementById('prev-filter-supervisor');
            if (!fundoSelect || !supervisorSelect) return;

            const currentFundo = fundoSelect.value;
            const currentSupervisor = supervisorSelect.value;

            // Extraer fundos únicos
            const fundos = Array.from(new Set((forms || []).map(f => (f.fundo_instalacion || '').trim()).filter(Boolean))).sort();
            
            // Extraer supervisores y asesores únicos
            const supervisoresSet = new Set();
            (forms || []).forEach(f => {
                if (f.supervisor && f.supervisor.trim()) supervisoresSet.add(f.supervisor.trim());
                if (f.asesor_prevencion && f.asesor_prevencion.trim()) supervisoresSet.add(f.asesor_prevencion.trim());
            });
            const supervisores = Array.from(supervisoresSet).sort();

            let fundoOptions = '<option value="">Todos los fundos (' + fundos.length + ')</option>';
            fundos.forEach(f => {
                fundoOptions += `<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`;
            });
            fundoSelect.innerHTML = fundoOptions;
            if (fundos.includes(currentFundo)) fundoSelect.value = currentFundo;

            let supervisorOptions = '<option value="">Todos los supervisores (' + supervisores.length + ')</option>';
            supervisores.forEach(s => {
                supervisorOptions += `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`;
            });
            supervisorSelect.innerHTML = supervisorOptions;
            if (supervisores.includes(currentSupervisor)) supervisorSelect.value = currentSupervisor;
        }

        function filtrarTablaPrevencionista() {
            const fundoValue = (document.getElementById('prev-filter-fundo')?.value || '').trim().toLowerCase();
            const supervisorValue = (document.getElementById('prev-filter-supervisor')?.value || '').trim().toLowerCase();
            const fechaValue = (document.getElementById('prev-filter-fecha')?.value || '').trim();
            const queryValue = (document.getElementById('prev-search-input')?.value || '').trim().toLowerCase();

            const activeFiltersBar = document.getElementById('prev-active-filters-bar');
            const activeChips = document.getElementById('prev-active-chips');
            const clearBtn = document.getElementById('btn-clear-filters');

            const filtered = (syncedFormsCache || []).filter(item => {
                // Filtro Fundo
                if (fundoValue) {
                    const itemFundo = (item.fundo_instalacion || '').toLowerCase();
                    if (itemFundo !== fundoValue) return false;
                }

                // Filtro Supervisor / Asesor
                if (supervisorValue) {
                    const itemSup = (item.supervisor || '').toLowerCase();
                    const itemPrev = (item.asesor_prevencion || '').toLowerCase();
                    if (itemSup !== supervisorValue && itemPrev !== supervisorValue) return false;
                }

                // Filtro Fecha (Compara YYYY-MM-DD contra fecha_inicio o synced_at/saved_at)
                if (fechaValue) {
                    const fechaInicio = (item.fecha_inicio || '').trim(); // p.ej. 2026-07-24
                    const syncedAt = item.synced_at ? new Date(item.synced_at).toISOString().split('T')[0] : '';
                    const savedAt = item.saved_at ? new Date(item.saved_at).toISOString().split('T')[0] : '';
                    if (fechaInicio !== fechaValue && syncedAt !== fechaValue && savedAt !== fechaValue) return false;
                }

                // Búsqueda General Texto
                if (queryValue) {
                    const searchStr = `${item.fundo_instalacion || ''} ${item.faena || ''} ${item.supervisor || ''} ${item.asesor_prevencion || ''} ${item.fecha_inicio || ''} ${item.nombre || ''}`.toLowerCase();
                    if (!searchStr.includes(queryValue)) return false;
                }

                return true;
            });

            // Actualizar chips de filtros activos
            const chips = [];
            if (fundoValue) {
                const rawName = document.getElementById('prev-filter-fundo')?.options[document.getElementById('prev-filter-fundo')?.selectedIndex]?.text || fundoValue;
                chips.push({ key: 'fundo', label: 'Fundo: ' + rawName });
            }
            if (supervisorValue) {
                const rawName = document.getElementById('prev-filter-supervisor')?.options[document.getElementById('prev-filter-supervisor')?.selectedIndex]?.text || supervisorValue;
                chips.push({ key: 'supervisor', label: 'Supervisor: ' + rawName });
            }
            if (fechaValue) {
                chips.push({ key: 'fecha', label: 'Fecha: ' + fechaValue });
            }
            if (queryValue) {
                chips.push({ key: 'query', label: 'Búsqueda: "' + queryValue + '"' });
            }

            if (chips.length > 0) {
                if (activeFiltersBar) activeFiltersBar.style.display = 'flex';
                if (clearBtn) clearBtn.style.display = 'inline-flex';
                if (activeChips) {
                    activeChips.innerHTML = chips.map(c => `
                        <span class="prev-chip">
                            ${escapeHTML(c.label)}
                            <span class="prev-chip-remove" onclick="removerFiltroPrevencionista('${c.key}')" title="Quitar filtro">&times;</span>
                        </span>
                    `).join('');
                }
            } else {
                if (activeFiltersBar) activeFiltersBar.style.display = 'none';
                if (clearBtn) clearBtn.style.display = 'none';
                if (activeChips) activeChips.innerHTML = '';
            }

            renderTablaPrevencionista(filtered);
        }

        function removerFiltroPrevencionista(key) {
            if (key === 'fundo') {
                const el = document.getElementById('prev-filter-fundo');
                if (el) el.value = '';
            } else if (key === 'supervisor') {
                const el = document.getElementById('prev-filter-supervisor');
                if (el) el.value = '';
            } else if (key === 'fecha') {
                const el = document.getElementById('prev-filter-fecha');
                if (el) el.value = '';
            } else if (key === 'query') {
                const el = document.getElementById('prev-search-input');
                if (el) el.value = '';
            }
            filtrarTablaPrevencionista();
        }

        function limpiarFiltrosPrevencionista() {
            const fundoEl = document.getElementById('prev-filter-fundo');
            const supEl = document.getElementById('prev-filter-supervisor');
            const fechaEl = document.getElementById('prev-filter-fecha');
            const searchEl = document.getElementById('prev-search-input');

            if (fundoEl) fundoEl.value = '';
            if (supEl) supEl.value = '';
            if (fechaEl) fechaEl.value = '';
            if (searchEl) searchEl.value = '';

            filtrarTablaPrevencionista();
        }

        function renderTablaPrevencionista(forms) {
            const tbody = document.getElementById('prevencionista-table-body');
            if (!tbody) return;

            // Actualizar Tarjetas de Métricas
            const metricTotal = document.getElementById('prev-metric-total');
            const metricFundos = document.getElementById('prev-metric-fundos');
            const metricPeligros = document.getElementById('prev-metric-peligros');
            const metricLastDate = document.getElementById('prev-metric-lastdate');
            const panelCount = document.getElementById('prev-panel-count');

            const formsList = forms || [];

            if (metricTotal) metricTotal.textContent = formsList.length;
            if (metricFundos) {
                const uniqueFundos = new Set(formsList.map(f => f.fundo_instalacion).filter(Boolean));
                metricFundos.textContent = uniqueFundos.size;
            }
            if (metricPeligros) {
                const totalPeligros = formsList.reduce((sum, f) => sum + (parseInt(f.cant_peligros) || 0), 0);
                metricPeligros.textContent = totalPeligros;
            }
            if (metricLastDate) {
                const withDate = formsList.find(f => f.synced_at || f.saved_at);
                if (withDate) {
                    const d = new Date(withDate.synced_at || withDate.saved_at);
                    metricLastDate.textContent = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                } else {
                    metricLastDate.textContent = '—';
                }
            }
            if (panelCount) {
                panelCount.textContent = formsList.length + (formsList.length === 1 ? ' registro' : ' registros');
            }

            if (formsList.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8">
                            <div class="prev-empty-state">
                                <div class="prev-empty-icon">
                                    <svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
                                </div>
                                <div class="prev-empty-text">
                                    No hay formularios sincronizados aún.<br>
                                    Los registros aparecerán aquí cuando se sincronicen desde la app móvil en terreno.
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            formsList.forEach((item, idx) => {
                const dateStr = item.synced_at ? new Date(item.synced_at).toLocaleString('es-CL') : (item.saved_at ? new Date(item.saved_at).toLocaleString('es-CL') : 'N/A');
                const fundoStr = escapeHTML(item.fundo_instalacion || 'Sin fundo');
                const faenaStr = escapeHTML(item.faena || 'Sin faena');
                const fechaStr = escapeHTML(item.fecha_inicio || 'N/A');
                const supervisorStr = escapeHTML(item.supervisor || 'N/A');
                const asesorStr = escapeHTML(item.asesor_prevencion || 'N/A');
                const peligros = parseInt(item.cant_peligros) || 0;
                const hazardClass = peligros >= 5 ? 'hazards-high' : 'hazards';

                const versionNum = parseInt(item.version || 1, 10);
                const versionBadge = `<span class="prev-version-badge ${versionNum > 1 ? 'v-edited' : ''}">v${versionNum}</span>`;

                html += `
                    <tr>
                        <td><span class="prev-cell-fundo">${fundoStr}</span> ${versionBadge}</td>
                        <td><span class="prev-cell-faena">${faenaStr}</span></td>
                        <td><span style="font-size:12.5px; font-weight:600;">${fechaStr}</span></td>
                        <td>
                            <div class="prev-cell-supervisor">${supervisorStr}</div>
                            <div class="prev-cell-asesor">Prev: ${asesorStr}</div>
                        </td>
                        <td class="center"><span class="prev-cell-count participants">${item.cant_participantes || 0}</span></td>
                        <td class="center"><span class="prev-cell-count ${hazardClass}">${peligros}</span></td>
                        <td><span class="prev-cell-date">${dateStr}</span></td>
                        <td class="center">
                            <div class="prev-actions-wrap">
                                <button type="button" class="btn-pdf-download" onclick="descargarPdfFormulario('${item.id}')" title="Generar PDF versión actual">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                                    PDF
                                </button>
                                <button type="button" class="btn-detail-view" onclick="cargarFormularioParaVer('${item.id}')" title="Ver detalle">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    Ver
                                </button>
                                <button type="button" class="btn-history-view" onclick="verHistorialFormulario('${item.id}')" title="Ver historial de revisiones (v1, v2...)">
                                    📜 Historial (${versionNum})
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        function verHistorialFormulario(id) {
            const item = syncedFormsCache.find(f => f.id === id);
            if (!item) return;

            const modal = document.getElementById('history-modal-overlay');
            const titleEl = document.getElementById('history-modal-title');
            const subtitleEl = document.getElementById('history-modal-subtitle');
            const bodyEl = document.getElementById('history-modal-body');

            if (!modal || !bodyEl) return;

            const fundoStr = escapeHTML(item.fundo_instalacion || 'Sin fundo');
            const faenaStr = escapeHTML(item.faena || 'Sin faena');
            const currentVersion = parseInt(item.version || 1, 10);
            const historyList = item.version_history || [];

            if (titleEl) titleEl.textContent = `📜 Historial de Revisiones: ${fundoStr}`;
            if (subtitleEl) subtitleEl.textContent = `Faena: ${faenaStr} | Versión actual activa: v${currentVersion}`;

            let html = '';

            // 1. Versión Actual (Principal)
            const dateCurrent = item.synced_at ? new Date(item.synced_at).toLocaleString('es-CL') : (item.saved_at ? new Date(item.saved_at).toLocaleString('es-CL') : 'N/A');
            html += `
                <div class="history-version-item current">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span class="history-version-tag current">v${currentVersion} (Actual)</span>
                            <span style="font-size:12px; font-weight:600; color:var(--text-muted);">${dateCurrent}</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-main);">
                            Supervisor: <strong>${escapeHTML(item.supervisor || 'N/A')}</strong> | Participantes: ${item.cant_participantes || 0} | Peligros: ${item.cant_peligros || 0}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn-pdf-download" onclick="descargarPdfFormulario('${item.id}'); cerrarModalHistorial();">
                            📄 PDF v${currentVersion}
                        </button>
                    </div>
                </div>
            `;

            // 2. Historial de versiones anteriores (en orden descendente)
            if (historyList.length > 0) {
                const historyReversed = [...historyList].reverse();
                historyReversed.forEach((hist, idx) => {
                    const vNum = hist.version || (historyList.length - idx);
                    const histDate = hist.synced_at ? new Date(hist.synced_at).toLocaleString('es-CL') : (hist.saved_at ? new Date(hist.saved_at).toLocaleString('es-CL') : 'N/A');
                    const realIndex = historyList.length - 1 - idx;

                    html += `
                        <div class="history-version-item">
                            <div>
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                    <span class="history-version-tag previous">v${vNum}</span>
                                    <span style="font-size:12px; font-weight:600; color:var(--text-muted);">${histDate}</span>
                                </div>
                                <div style="font-size:12px; color:var(--text-muted);">
                                    Revisión histórica archivada | Participantes: ${hist.cant_participantes || 0} | Peligros: ${hist.cant_peligros || 0}
                                </div>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="btn-detail-view" onclick="descargarPdfVersionHistorica('${item.id}', ${realIndex}); cerrarModalHistorial();">
                                    📄 PDF v${vNum}
                                </button>
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div style="text-align:center; padding:20px; font-size:13px; color:var(--text-muted);">
                        ℹ️ Este formulario se encuentra en su versión inicial (v1) y no registra modificaciones anteriores.
                    </div>
                `;
            }

            bodyEl.innerHTML = html;
            modal.style.display = 'flex';
        }

        function cerrarModalHistorial() {
            const modal = document.getElementById('history-modal-overlay');
            if (modal) modal.style.display = 'none';
        }

        async function descargarPdfVersionHistorica(formId, historyIndex) {
            const item = syncedFormsCache.find(f => f.id === formId);
            if (!item || !item.version_history || !item.version_history[historyIndex]) {
                showToast('❌ No se encontró la versión histórica especificada', 'danger');
                return;
            }
            const histRecord = item.version_history[historyIndex];
            const histData = histRecord.data_payload;

            showToast(`Generando PDF versión v${histRecord.version || (historyIndex + 1)}...`, 'info');
            
            deserializeForm(histData);
            setTimeout(() => {
                exportarAPdf();
            }, 300);
        }

        async function descargarPdfFormulario(id) {
            showToast('Recuperando datos del servidor...', 'info');
            let formRecord = syncedFormsCache.find(f => f.id === id);

            if (!formRecord || !formRecord.data) {
                try {
                    const res = await tryFetchWithFallback(`/api/forms/${id}`);
                    const json = await res.json();
                    if (json.success && json.form) {
                        formRecord = json.form;
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            if (!formRecord || !formRecord.data) {
                showToast('Error: No se encontraron los datos completos del registro', 'danger');
                return;
            }

            const currentFormData = serializeForm();
            deserializeForm(formRecord.data);

            showToast('Generando PDF oficial desde los datos de la base de datos...', 'info');
            setTimeout(() => {
                exportarAPdf();
                // Restore user's current draft after generating PDF
                setTimeout(() => {
                    deserializeForm(currentFormData);
                }, 800);
            }, 300);
        }

        function cargarFormularioParaVer(id) {
            const formRecord = syncedFormsCache.find(f => f.id === id);
            if (!formRecord || !formRecord.data) return;

            const formContainer = document.getElementById('view-form-container');
            const prevContainer = document.getElementById('view-prevencionista-container');
            if (formContainer) formContainer.style.display = 'block';
            if (prevContainer) prevContainer.style.display = 'none';

            deserializeForm(formRecord.data);

            // Ocultar botones de guardado/sincronización
            const actionBtns = document.getElementById('offline-dashboard');
            if (actionBtns) actionBtns.style.display = 'none';
            const submitContainer = document.getElementById('submit-container');
            if (submitContainer) submitContainer.style.display = 'none';

            let backBtn = document.getElementById('btn-back-to-prevencionista');
            if (!backBtn) {
                backBtn = document.createElement('button');
                backBtn.id = 'btn-back-to-prevencionista';
                backBtn.type = 'button';
                backBtn.className = 'btn-secondary';
                backBtn.style.cssText = 'width:100%; padding:14px; margin-bottom:15px; background:var(--primary); color:white; font-weight:bold; font-size:14px; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';
                backBtn.innerHTML = '← Volver a la Lista de Registros Sincronizados';
                backBtn.onclick = function() {
                    if (formContainer) formContainer.style.display = 'none';
                    if (prevContainer) prevContainer.style.display = 'block';
                    if (actionBtns) actionBtns.style.display = 'block';
                    if (submitContainer) submitContainer.style.display = 'flex';
                };
                formContainer.insertBefore(backBtn, formContainer.firstChild);
            } else {
                backBtn.style.display = 'flex';
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast(`Viendo registro de ${formRecord.fundo_instalacion || 'BD'} (Modo Lectura)`, 'info');
        }

        function borrarFormulario(formId) {
            if (!confirm('¿Eliminar este formulario guardado? Esta acción no se puede deshacer.')) return;
            let list = getSavedFormsList();
            list = list.filter(f => f.id !== formId);
            setSavedFormsList(list);
            localStorage.removeItem('irf_form_' + formId);
            if (currentActiveFormId === formId) {
                currentActiveFormId = 'irf_' + Date.now();
            }
            renderSavedForms();
            showToast('Formulario eliminado.', 'info');
        }

        function nuevoFormulario() {
            if (confirm('¿Crear nuevo formulario? Perderá los datos no guardados en pantalla.')) {
                document.getElementById('irf-form').reset();
                if (typeof pad0 !== 'undefined' && pad0) pad0.clear();
                if (typeof pad1 !== 'undefined' && pad1) pad1.clear();
                if (typeof pad2 !== 'undefined' && pad2) pad2.clear();
                if (typeof pad3 !== 'undefined' && pad3) pad3.clear();
                if (typeof pad4 !== 'undefined' && pad4) pad4.clear();
                participantesList = [];
                peligrosList = [];
                if (typeof actualizarTablaParticipantes === 'function') actualizarTablaParticipantes();
                if (typeof actualizarTablaPeligros === 'function') actualizarTablaPeligros();
                // Reset chip container
                const contContainer = document.getElementById('peligro_controles_container');
                if (contContainer) {
                    contContainer.innerHTML = '<div style="font-size:13px; color:var(--text-muted); font-style:italic;">Seleccione un peligro para ver las medidas sugeridas.</div>';
                }
                // Re-init custom selects in case they need refresh
                if (typeof initCustomSelects === 'function') setTimeout(initCustomSelects, 100);
                currentActiveFormId = 'irf_' + Date.now();
                showToast('Nuevo formulario listo', 'success');
            }
        }

        function cargarFormulario(formId) {
            if (!confirm('¿Cargar este formulario? Los datos no guardados actuales se perderán.')) return;
            const raw = localStorage.getItem('irf_form_' + formId);
            if (!raw) {
                showToast('No se encontraron datos del formulario', 'danger');
                return;
            }
            const formObj = JSON.parse(raw);
            document.getElementById('irf-form').reset();
            participantesList = [];
            peligrosList = [];
            deserializeForm(formObj.data);
            currentActiveFormId = formId;
            showToast('✅ Formulario "' + formObj.nombre + '" cargado.', 'success');
            const dash = document.getElementById('offline-dashboard');
            if (dash && dash.classList.contains('active')) toggleAccordion('offline-dashboard');
        }

        function serializeForm() {
            const draft = {
                inputs: {},
                participantes: typeof participantesList !== 'undefined' ? participantesList : [],
                peligros: typeof peligrosList !== 'undefined' ? peligrosList : []
            };
            document.querySelectorAll('#irf-form input, #irf-form select, #irf-form textarea').forEach(el => {
                if (el.id && el.type !== 'file') {
                    draft.inputs[el.id] = el.value;
                }
            });
            return draft;
        }

        function deserializeForm(draft) {
            if (!draft) return;
            try {
                // Restore standard inputs
                for (const [id, value] of Object.entries(draft.inputs || {})) {
                    const el = document.getElementById(id);
                    if (el && el.type !== 'file') {
                        el.value = value;
                        // If it's a signature, draw it
                        if (id === 'firma_jefe_faena_input' && typeof pad0 !== 'undefined' && pad0) pad0.load(value);
                        if (id === 'firma_asesor_prev_eess_intervencion_input' && typeof pad1 !== 'undefined' && pad1) pad1.load(value);
                        if (id === 'firma_supervision_eess_intervencion_input' && typeof pad2 !== 'undefined' && pad2) pad2.load(value);
                        if (id === 'firma_asesor_prev_eess_recepcion_input' && typeof pad3 !== 'undefined' && pad3) pad3.load(value);
                        if (id === 'firma_supervision_eess_recepcion_input' && typeof pad4 !== 'undefined' && pad4) pad4.load(value);
                    }
                }
                if (draft.participantes) {
                    participantesList = draft.participantes;
                    if (typeof actualizarTablaParticipantes === 'function') actualizarTablaParticipantes();
                }
                if (draft.peligros) {
                    peligrosList = draft.peligros;
                    if (typeof actualizarTablaPeligros === 'function') actualizarTablaPeligros();
                    if (typeof updateFirssoInicialUI === 'function') updateFirssoInicialUI();
                }
            } catch (e) {
                console.error("Error deserializing form", e);
            }
        }

        async function guardarBorrador() {
            if (!currentActiveFormId) currentActiveFormId = 'irf_' + Date.now();

            // Commit signature pad values to hidden input fields if available
            try {
                if (typeof pad0 !== 'undefined' && pad0 && pad0.save) pad0.save();
                if (typeof pad1 !== 'undefined' && pad1 && pad1.save) pad1.save();
                if (typeof pad2 !== 'undefined' && pad2 && pad2.save) pad2.save();
                if (typeof pad3 !== 'undefined' && pad3 && pad3.save) pad3.save();
                if (typeof pad4 !== 'undefined' && pad4 && pad4.save) pad4.save();
            } catch (e) {
                console.warn('Signature pad save warning:', e);
            }

            const fundoEl = document.getElementById('fundo_instalacion');
            const fechaEl = document.getElementById('fecha_inicio');
            const fundo = fundoEl?.value?.trim() || 'Sin nombre';
            const fecha = fechaEl?.value || new Date().toISOString().split('T')[0];
            const nombre = `IRF - ${fundo} (${fecha})`;

            const formObj = {
                id: currentActiveFormId,
                nombre: nombre,
                savedAt: Date.now(),
                data: serializeForm()
            };

            let savedLocally = false;
            try {
                localStorage.setItem('irf_form_' + currentActiveFormId, JSON.stringify(formObj));
                savedLocally = true;
            } catch (quotaErr) {
                console.warn('LocalStorage Quota Exceeded, cleaning old synced items:', quotaErr);
                try {
                    let list = getSavedFormsList();
                    const unSynced = list.filter(item => !item.synced);
                    const synced = list.filter(item => item.synced);
                    if (synced.length > 0) {
                        synced.forEach(s => localStorage.removeItem('irf_form_' + s.id));
                        setSavedFormsList(unSynced);
                    }
                    localStorage.setItem('irf_form_' + currentActiveFormId, JSON.stringify(formObj));
                    savedLocally = true;
                } catch (retryErr) {
                    console.error('Failed to save to localStorage after cleanup:', retryErr);
                }
            }

            // Update index
            let list = getSavedFormsList() || [];
            const existing = list.findIndex(f => f.id === currentActiveFormId);
            const indexEntry = { id: currentActiveFormId, nombre: nombre, savedAt: formObj.savedAt };
            if (existing >= 0) {
                list[existing] = indexEntry;
            } else {
                list.push(indexEntry);
            }

            try {
                setSavedFormsList(list);
                renderSavedForms();
            } catch (e) {
                console.warn('Error updating saved forms UI:', e);
            }

            if (savedLocally) {
                showToast('✅ Formulario guardado localmente: "' + nombre + '"', 'success');
            } else {
                showToast('⚠️ Formulario preparado para sincronización.', 'info');
            }

            return formObj;
        }

        async function guardarFinalizado() {
            showToast('💾 Guardando formulario y sincronizando...', 'info');
            const formObj = await guardarBorrador();
            await sincronizarTodos(formObj);
        }

// --- Expose to global scope for inline HTML handlers ---
window.configurarServidorUrl = configurarServidorUrl;
window.actualizarTablaPeligros = actualizarTablaPeligros;
window.toggleSosModal = toggleSosModal;
window.toggleAccordion = toggleAccordion;
window.getCurrentLocation = getCurrentLocation;
window.updateFirssoResidualUI = updateFirssoResidualUI;
window.initPeligroSelect = initPeligroSelect;
window.exportarAPdf = exportarAPdf;
window.initAndroidApp = initAndroidApp;
window.getRiskLevel = getRiskLevel;
window.checkConnectionStatus = checkConnectionStatus;
window.initFundoAutocomplete = initFundoAutocomplete;
window.renderSavedForms = renderSavedForms;
window.toggleTheme = toggleTheme;
window.guardarFinalizado = guardarFinalizado;
window.autoFillCargo = autoFillCargo;
window.initCustomAutocomplete = initCustomAutocomplete;
window.sincronizarTodos = sincronizarTodos;
window.borrarFormulario = borrarFormulario;
window.saveDraft = saveDraft;
window.guardarBorrador = guardarBorrador;
window.checkStepCompletion = checkStepCompletion;
window.agregarUsuario = agregarUsuario;
window.deserializeForm = deserializeForm;
window.eliminarPeligro = eliminarPeligro;
window.eliminarUsuario = eliminarUsuario;
window.nuevoFormulario = nuevoFormulario;
window.updateFirssoInicialUI = updateFirssoInicialUI;
window.agregarPeligro = agregarPeligro;
window.actualizarTablaParticipantes = actualizarTablaParticipantes;
window.loadDraft = loadDraft;
window.editarFormulario = cargarFormulario;
window.cargarFormulario = cargarFormulario;
window.showToast = showToast;
window.serializeForm = serializeForm;
window.switchMainTab = switchMainTab;
window.cargarFormulariosPrevencionista = cargarFormulariosPrevencionista;
window.filtrarTablaPrevencionista = filtrarTablaPrevencionista;
window.descargarPdfFormulario = descargarPdfFormulario;
window.cargarFormularioParaVer = cargarFormularioParaVer;
window.procesarLogin = procesarLogin;
window.cerrarSesion = cerrarSesion;
window.removerFiltroPrevencionista = removerFiltroPrevencionista;
window.limpiarFiltrosPrevencionista = limpiarFiltrosPrevencionista;
window.verHistorialFormulario = verHistorialFormulario;
window.cerrarModalHistorial = cerrarModalHistorial;
window.descargarPdfVersionHistorica = descargarPdfVersionHistorica;
window.participantesList = participantesList;
window.peligrosList = peligrosList;



