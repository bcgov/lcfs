import React, { useState, useEffect }  from 'react';
import { Button, TextField, Grid } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios'
import useApiService from '../../services/useApiService';

const NewUser = () => {
  const apiService = useApiService();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title: '',
    username: '',
    email: '',
    phone: '',
    mobile_phone: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Request URL:', `${apiService.defaults.baseURL}/users/create`);
      const response = await apiService.post('/users/create', formData);
      console.log('Response:', response);
    } catch (error) {
      console.error('Error submitting:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2} xs={6}>
        <Grid item xs={12}>
        <TextField
          label="First Name"
          required
          fullWidth
          value={formData.first_name} 
          onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
        />
        </Grid>
        <Grid item xs={12}>
          <TextField 
            label="Last Name" 
            required 
            fullWidth
            value={formData.last_name}
            onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
        </Grid>
        <Grid item xs={12}>
          <TextField 
            label="Job Title" 
            required 
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})} />
        </Grid>
        <Grid item xs={12}>
          <TextField 
            label="IDIR User Name" 
            required 
            fullWidth
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})} />
        </Grid>
        <Grid item xs={12}>
          {/* <TextField label="Email Address" fullWidth /> */}
          <TextField 
            label="Email Address" 
            fullWidth
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})} />
        </Grid>
        <Grid item xs={12}>
          <TextField 
            label="Phone" 
            fullWidth
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})} />
        </Grid>
        <Grid item xs={12}>
          <TextField 
            label="Mobile Phone" 
            fullWidth
            value={formData.mobile_phone}
            onChange={(e) => setFormData({...formData, mobile_phone: e.target.value})} />
        </Grid>
        <Grid item xs={6}>
          <Button variant="contained" color="dark" style={{width: 150}}>
          <ArrowBackIcon />  Back
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button variant="contained" color="primary" type="submit" style={{width: 150}}>
          <SaveIcon />  Save
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

export default NewUser;
