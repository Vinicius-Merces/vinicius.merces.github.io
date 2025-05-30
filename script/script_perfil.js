document.addEventListener('DOMContentLoaded', () => {
    // Inicializar navbar de autenticação
    AuthUtils.initAuthNavbar();
    
    // Inicializar elementos
    initProfilePage();
    
    // Configurar eventos
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('changePhotoBtn').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });
    document.getElementById('photoUpload').addEventListener('change', handlePhotoUpload);
    
    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Form submission
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
});

async function initProfilePage() {
    try {
        // Verificar autenticação
        const isAuthenticated = await AuthUtils.isUserLoggedIn();
        if (!isAuthenticated) {
            window.location.href = 'login.html';
            return;
        }
        
        // Carregar dados do usuário
        const user = await AuthUtils.getCurrentUser();
        const userData = await AuthUtils.getUserData(user.uid);
        
        // Preencher informações do perfil
        document.getElementById('profileName').textContent = userData?.nome || 'Usuário';
        document.getElementById('profileNameInput').value = userData?.nome || '';
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profileEmailText').textContent = user.email;
        document.getElementById('profilePhone').textContent = userData?.telefone || 'Não informado';
        document.getElementById('profilePhoneInput').value = userData?.telefone || '';
        
        // Formatar data de cadastro
        if (userData?.dataCadastro?.toDate) {
            const joinDate = userData.dataCadastro.toDate();
            const formattedDate = joinDate.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            document.getElementById('profileMemberSince').textContent = `Membro desde: ${formattedDate}`;
        }
        
        // Carregar foto de perfil se existir
        const profilePhoto = document.getElementById('profilePhoto');
        if (userData?.fotoUrl) {
            profilePhoto.innerHTML = `<img src="${userData.fotoUrl}" class="rounded-circle w-100 h-100 object-fit-cover" alt="Foto de perfil">`;
        } else {
            profilePhoto.innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
        }
        
        // Carregar agendamentos
        loadUserAppointments(user.uid);
        
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showAlert('Erro ao carregar informações do perfil. Tente novamente mais tarde.', 'danger');
    }
}

async function loadUserAppointments(userId) {
    try {
        const appointmentsRef = firebase.firestore().collection('agendamentos')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(5);
        
        const snapshot = await appointmentsRef.get();
        const appointmentsList = document.getElementById('appointmentsList');
        const noAppointments = document.getElementById('noAppointments');
        const loading = document.getElementById('appointmentsLoading');
        
        // Mostrar loading enquanto carrega
        loading.classList.remove('d-none');
        appointmentsList.classList.add('d-none');
        noAppointments.classList.add('d-none');
        
        if (snapshot.empty) {
            loading.classList.add('d-none');
            noAppointments.classList.remove('d-none');
            return;
        }
        
        loading.classList.add('d-none');
        appointmentsList.classList.remove('d-none');
        appointmentsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const appointment = doc.data();
            const date = new Date(appointment.dataHoraISO);
            const formattedDate = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Determinar a classe do badge com base no status
            let statusClass;
            switch(appointment.status) {
                case 'pendente':
                    statusClass = 'badge-pendente';
                    break;
                case 'confirmado':
                    statusClass = 'badge-confirmado';
                    break;
                case 'cancelado':
                    statusClass = 'badge-cancelado';
                    break;
                case 'concluido':
                    statusClass = 'badge-concluido';
                    break;
                default:
                    statusClass = 'badge-pendente';
            }
            
            appointmentsList.innerHTML += `
                <div class="appointment-item">
                    <div class="appointment-details">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0 fw-medium">${appointment.servico}</h6>
                            <span class="status-badge ${statusClass}">${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}</span>
                        </div>
                        <p class="mb-1"><i class="far fa-calendar-alt me-2 text-primary"></i>${formattedDate}</p>
                        <p class="mb-0"><i class="fas fa-user me-2 text-primary"></i>Profissional: ${appointment.profissional || 'A definir'}</p>
                    </div>
                    <div class="appointment-actions mt-3">
                        <button class="btn btn-outline-beauty btn-sm ${appointment.status === 'cancelado' || appointment.status === 'concluido' ? 'd-none' : ''}" data-id="${doc.id}">
                            <i class="fas fa-times me-1"></i> Cancelar
                        </button>
                        <button class="btn btn-outline-beauty btn-sm ms-2" data-id="${doc.id}" data-bs-toggle="modal" data-bs-target="#appointmentDetailsModal">
                            <i class="fas fa-info-circle me-1"></i> Detalhes
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Adicionar eventos para cancelamento
        document.querySelectorAll('.appointment-actions .btn-outline-beauty').forEach(btn => {
            if (btn.innerHTML.includes('Cancelar')) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const appointmentId = this.getAttribute('data-id');
                    cancelAppointment(appointmentId);
                });
            }
        });
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showAlert('Erro ao carregar seus agendamentos. Tente novamente mais tarde.', 'danger');
    }
}

async function updateProfile(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const buttonText = btn.querySelector('.button-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    // Mostrar estado de carregamento
    buttonText.textContent = 'Salvando...';
    spinner.classList.remove('d-none');
    btn.disabled = true;
    
    try {
        const user = await AuthUtils.getCurrentUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }
        
        const userData = {
            nome: AuthUtils.sanitizeInput(document.getElementById('profileNameInput').value.trim()),
            telefone: AuthUtils.sanitizeInput(document.getElementById('profilePhoneInput').value.trim())
        };
        
        // Validar campos
        if (!userData.nome || !userData.telefone) {
            throw new Error('Por favor, preencha todos os campos obrigatórios.');
        }
        
        // Validar telefone
        const phoneDigits = userData.telefone.replace(/\D/g, '');
        if (!/^\d{10,11}$/.test(phoneDigits)) {
            throw new Error('Número de WhatsApp inválido. Use DDD + número (10 ou 11 dígitos).');
        }
        
        // Formatar telefone para exibição
        const formattedPhone = phoneDigits.length === 11 ? 
            `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2, 7)}-${phoneDigits.substring(7)}` :
            `(${phoneDigits.substring(0, 2)}) ${phoneDigits.substring(2, 6)}-${phoneDigits.substring(6)}`;
        
        // Atualizar senha se fornecida
        const newPassword = document.getElementById('profilePassword').value.trim();
        if (newPassword) {
            if (newPassword.length < 6) {
                throw new Error('A senha deve ter pelo menos 6 caracteres.');
            }
            await user.updatePassword(newPassword);
        }
        
        // Atualizar dados no Firestore
        await AuthUtils.updateUserData(user.uid, userData);
        
        // Atualizar exibição
        document.getElementById('profileName').textContent = userData.nome;
        document.getElementById('profilePhone').textContent = formattedPhone;
        
        showAlert('Perfil atualizado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showAlert(`Erro ao atualizar perfil: ${error.message}`, 'danger');
    } finally {
        // Restaurar estado normal do botão
        buttonText.textContent = 'Atualizar Perfil';
        spinner.classList.add('d-none');
        btn.disabled = false;
    }
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const user = await AuthUtils.getCurrentUser();
        if (!user) return;
        
        // Mostrar spinner durante o upload
        const profilePhoto = document.getElementById('profilePhoto');
        profilePhoto.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        
        // Referência do Storage
        const storageRef = firebase.storage().ref();
        
        // Criar referência para a foto
        const photoRef = storageRef.child(`profile_photos/${user.uid}/profile_${Date.now()}.jpg`);
        
        // Fazer upload básico sem metadados extras
        const uploadTask = photoRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress: ' + progress + '%');
            },
            (error) => {
                console.error('Erro no upload:', error);
                showAlert('Erro ao enviar a foto. Tente novamente.', 'danger');
                resetProfilePhoto(user.uid);
            },
            async () => {
                try {
                    const photoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    await AuthUtils.updateUserData(user.uid, { fotoUrl: photoUrl });
                    profilePhoto.innerHTML = `<img src="${photoUrl}" class="rounded-circle w-100 h-100 object-fit-cover" alt="Foto de perfil">`;
                    showAlert('Foto de perfil atualizada com sucesso!', 'success');
                } catch (error) {
                    console.error('Erro ao obter URL:', error);
                    showAlert('Erro ao processar a foto. Tente novamente.', 'danger');
                    resetProfilePhoto(user.uid);
                }
            }
        );
        
    } catch (error) {
        console.error('Erro ao atualizar foto de perfil:', error);
        showAlert('Erro ao atualizar foto de perfil. Tente novamente.', 'danger');
        resetProfilePhoto(user.uid);
    }
}

async function resetProfilePhoto(userId) {
    try {
        const userData = await AuthUtils.getUserData(userId);
        const profilePhoto = document.getElementById('profilePhoto');
        
        if (userData?.fotoUrl) {
            profilePhoto.innerHTML = `<img src="${userData.fotoUrl}" class="rounded-circle w-100 h-100 object-fit-cover" alt="Foto de perfil">`;
        } else {
            profilePhoto.innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
        }
    } catch (error) {
        console.error('Erro ao resetar foto:', error);
        profilePhoto.innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
    }
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
    try {
        const user = await AuthUtils.getCurrentUser();
        if (!user) return;
        
        // Atualizar status do agendamento
        await firebase.firestore().collection('agendamentos').doc(appointmentId).update({
            status: 'cancelado',
            canceladoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Recarregar agendamentos
        loadUserAppointments(user.uid);
        
        showAlert('Agendamento cancelado com sucesso.', 'success');
        
    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        showAlert('Erro ao cancelar agendamento. Tente novamente.', 'danger');
    }
}

function logout() {
    AuthUtils.logout().then(() => {
        window.location.href = 'index.html';
    });
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('profileAlert');
    const alertMessage = alertDiv.querySelector('.alert-message') || document.createElement('span');
    
    alertMessage.textContent = message;
    alertMessage.className = 'alert-message';
    
    alertDiv.innerHTML = '';
    alertDiv.appendChild(alertMessage);
    
    alertDiv.className = `alert alert-${type} d-block alert-dismissible fade show`;
    
    // Adicionar botão de fechar
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'alert');
    closeButton.setAttribute('aria-label', 'Close');
    alertDiv.appendChild(closeButton);
    
    // Esconder após 5 segundos para sucesso
    if (type === 'success') {
        setTimeout(() => {
            alertDiv.classList.add('d-none');
        }, 5000);
    }
}
