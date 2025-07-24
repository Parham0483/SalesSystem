import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api'; // Assuming API setup is in this path
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
//import '../styles/Admin/AdminAnnouncements.css'; // You would create this CSS file

const AdminAnnouncementsPage = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal and Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [formData, setFormData] = useState({});
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    const navigate = useNavigate();

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/announcements/');
            setAnnouncements(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching announcements:', err);
            setError('خطا در بارگیری اطلاعیه‌ها');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    const handleOpenModal = (announcement = null) => {
        setEditingAnnouncement(announcement);
        if (announcement) {
            setFormData({ ...announcement });
            // Note: We can't pre-populate file inputs. We can show existing images.
            setImagePreviews(announcement.images ? announcement.images.map(img => img.image) : []);
        } else {
            setFormData({
                title: '',
                description: '',
                is_active: true,
                is_featured: false,
            });
            setImagePreviews([]);
        }
        setImageFiles([]);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAnnouncement(null);
        setFormData({});
        setImageFiles([]);
        setImagePreviews([]);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length) {
            setImageFiles(files);
            const previews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(previews);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const submissionForm = new FormData();

        // Append text fields
        Object.keys(formData).forEach(key => {
            if (!['images', 'id'].includes(key) && formData[key] !== null) {
                submissionForm.append(key, formData[key]);
            }
        });

        // Append new image files
        imageFiles.forEach(file => {
            submissionForm.append('images', file);
        });

        // Use PATCH for updating to avoid clearing existing images unless new ones are sent
        const url = editingAnnouncement ? `/admin/announcements/${editingAnnouncement.id}/` : '/admin/announcements/';
        const method = editingAnnouncement ? 'patch' : 'post';

        try {
            await API[method](url, submissionForm, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchAnnouncements();
            handleCloseModal();
        } catch (err) {
            console.error('❌ Error saving announcement:', err.response?.data);
            setError(`خطا در ذخیره اطلاعیه: ${JSON.stringify(err.response?.data)}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('آیا از حذف این اطلاعیه اطمینان دارید؟')) {
            try {
                await API.delete(`/admin/announcements/${id}/`);
                fetchAnnouncements();
            } catch (err) {
                console.error('Error deleting announcement', err);
                setError('خطا در حذف اطلاعیه');
            }
        }
    };

    if (loading) return <div className="admin-page-container"><h1>در حال بارگیری...</h1></div>;

    return (
        <div className="admin-page-container admin-announcements-page" dir="rtl">
            <div className="page-header">
                <h1>📢 مدیریت اطلاعیه محموله‌ها</h1>
                <NeoBrutalistButton
                    text="+ ثبت اطلاعیه جدید"
                    color="green-400"
                    textColor="black"
                    onClick={() => handleOpenModal()}
                />
            </div>

            {error && <div className="error-banner">⚠️ {error}</div>}

            <div className="announcements-grid">
                {announcements.map(ann => (
                    <NeoBrutalistCard key={ann.id} className="announcement-card">
                        <div className="card-header">
                            <h3>{ann.title}</h3>
                            <div className="status-badges">
                                {ann.is_featured && <span className="badge featured">ویژه</span>}
                                <span className={`badge ${ann.is_active ? 'active' : 'inactive'}`}>
                                    {ann.is_active ? 'فعال' : 'غیرفعال'}
                                </span>
                            </div>
                        </div>
                        <p className="card-description">{ann.description.substring(0, 150)}...</p>
                        <div className="card-images-preview">
                            {(ann.images || []).slice(0, 3).map(img => (
                                <img key={img.id} src={img.image} alt="preview" className="preview-thumb" />
                            ))}
                            {(ann.images || []).length > 3 && <span className="more-images-count">+{(ann.images).length - 3}</span>}
                        </div>
                        <div className="card-footer">
                            <span className="date">ایجاد: {new Date(ann.created_at).toLocaleDateString('fa-IR')}</span>
                            <div className="actions">
                                <NeoBrutalistButton text="ویرایش" color="blue-400" textColor="white" onClick={() => handleOpenModal(ann)} />
                                <NeoBrutalistButton text="حذف" color="red-400" textColor="white" onClick={() => handleDelete(ann.id)} />
                            </div>
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            <NeoBrutalistModal isOpen={isModalOpen} onClose={handleCloseModal} title={editingAnnouncement ? 'ویرایش اطلاعیه' : 'ثبت اطلاعیه جدید'}>
                <form onSubmit={handleFormSubmit} className="announcement-form">
                    <div className="form-group">
                        <label>عنوان اطلاعیه</label>
                        <NeoBrutalistInput name="title" value={formData.title || ''} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                        <label>توضیحات</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleFormChange} rows="5" className="form-textarea" required></textarea>
                    </div>

                    <div className="form-group">
                        <label>تصاویر محموله (می‌توانید چند تصویر انتخاب کنید)</label>
                        <input type="file" onChange={handleFileChange} multiple accept="image/*" className="file-input"/>
                        <div className="image-previews-container">
                            {imagePreviews.map((src, i) => <img key={i} src={src} alt={`preview ${i}`} className="image-preview" />)}
                        </div>
                        {editingAnnouncement && <p className="form-note">توجه: آپلود تصاویر جدید، تصاویر قبلی را پاک کرده و این موارد را جایگزین می‌کند.</p>}
                    </div>

                    <div className="form-row">
                        <div className="form-group form-group-checkbox">
                            <label htmlFor="is_active">اطلاعیه فعال باشد</label>
                            <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active || false} onChange={handleFormChange} />
                        </div>
                        <div className="form-group form-group-checkbox">
                            <label htmlFor="is_featured">به عنوان ویژه نمایش داده شود</label>
                            <input type="checkbox" id="is_featured" name="is_featured" checked={formData.is_featured || false} onChange={handleFormChange} />
                        </div>
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton text="لغو" color="gray-400" textColor="black" onClick={handleCloseModal} type="button" />
                        <NeoBrutalistButton text="ذخیره" color="green-400" textColor="black" type="submit" />
                    </div>
                </form>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminAnnouncementsPage;
