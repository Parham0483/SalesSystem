# forms.py
from django import forms
from django.contrib.auth.hashers import make_password
from django.forms import inlineformset_factory
from .models import Customer, Order, OrderItem, Product


class CustomerRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput())
    password_confirm = forms.CharField(widget=forms.PasswordInput())  # Match the existing field name

    class Meta:
        model = Customer
        fields = ['name', 'email', 'phone', 'password', 'company_name']
        widgets = {
            'password': forms.PasswordInput(),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')

        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("Passwords don't match")
        return cleaned_data

    def save(self, commit=True):
        customer = super().save(commit=False)
        customer.password = make_password(self.cleaned_data['password'])  # Hash the password
        if commit:
            customer.save()
        return customer


class CustomerLoginForm(forms.Form):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput())


class OrderForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ['customer_comment']
        widgets = {
            'customer_comment': forms.Textarea(attrs={'rows': 4, 'placeholder': 'Special requirements or notes...'})
        }


class OrderItemForm(forms.ModelForm):
    class Meta:
        model = OrderItem
        fields = ['product', 'requested_quantity', 'customer_notes']
        widgets = {
            'customer_notes': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Special requirements for this item...'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only show active products
        self.fields['product'].queryset = Product.objects.filter(is_active=True)


# Formset for multiple order items
OrderItemFormSet = inlineformset_factory(
    Order, 
    OrderItem, 
    form=OrderItemForm,
    extra=1,  # Number of empty forms to display
    can_delete=True,
    min_num=1,  # Minimum number of forms
    validate_min=True
)


class AdminPricingForm(forms.ModelForm):
    """Form for admin to provide pricing"""
    class Meta:
        model = OrderItem
        fields = ['quoted_unit_price', 'final_quantity', 'admin_notes']
        widgets = {
            'admin_notes': forms.Textarea(attrs={'rows': 3})
        }


class OrderApprovalForm(forms.Form):
    """Form for customer to approve or reject pricing"""
    CHOICES = [
        ('approve', 'Approve Order'),
        ('reject', 'Reject Order')
    ]
    decision = forms.ChoiceField(choices=CHOICES, widget=forms.RadioSelect())
    rejection_reason = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 3}), 
        required=False,
        help_text="Please provide reason if rejecting"
    )
    
    def clean(self):
        cleaned_data = super().clean()
        decision = cleaned_data.get('decision')
        rejection_reason = cleaned_data.get('rejection_reason')
        
        if decision == 'reject' and not rejection_reason:
            raise forms.ValidationError("Please provide a reason for rejection")
        return cleaned_data


