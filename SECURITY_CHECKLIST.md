# 🔐 Security Checklist for Bundle Ghana

## ✅ Git Security
- [x] `node_modules/` is in `.gitignore`
- [x] `.env*` files are in `.gitignore`
- [x] API keys should only be in environment variables

## 🚨 Immediate Actions Required

### 1. Check for Committed API Keys
```bash
# Check if any API keys were accidentally committed
git log --all --full-history --source -- "*paystack*" "*key*" "*secret*"
git grep -r "pk_test_" -- . ':!node_modules' ':!.git'
git grep -r "sk_test_" -- . ':!node_modules' ':!.git'
```

### 2. Remove Committed Keys (if found)
```bash
# If any keys are found, remove them from history
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch FILE_WITH_KEY' --prune-empty --tag-name-filter cat -- --all
```

### 3. Rotate Exposed Keys
If your Paystack test key was exposed:
1. Go to Paystack Dashboard
2. Deactivate the exposed test key
3. Generate a new test key
4. Update environment variables in Vercel

## 📋 Environment Variables Security

### Required Environment Variables (Both Sites)
```
# Paystack (NEVER commit these)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxx

# Dakazina Webhook
DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# DataKazina
DATAKAZINA_API_KEY=your-api-key
DATAKAZINA_BASE_URL=https://reseller.dakazinabusinessconsult.com/api/v1
```

## 🔍 Security Best Practices

### Code Security
- [x] No hardcoded API keys in source code
- [x] Webhook secret validation implemented
- [x] Environment variables used for all secrets
- [x] Error messages don't expose sensitive data

### Webhook Security
- [x] Webhook endpoint validates secret
- [x] Test webhooks are properly handled
- [x] Rate limiting considerations
- [x] Request logging without exposing sensitive data

### Database Security
- [x] Service role key usage is limited
- [x] Row Level Security (RLS) policies
- [x] No sensitive data in API responses

## 🚀 Deployment Security

### Vercel Environment Variables
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add all required environment variables
3. Select appropriate environments (Production, Preview, Development)
4. Redeploy to apply new variables

### Paystack Configuration
1. Add both domains to Paystack Dashboard:
   - `sbbundles-main.vercel.app`
   - `bundles-store.vercel.app`
2. Configure webhook URLs
3. Set up proper IP restrictions if needed

## 🧪 Security Testing

### Test Webhook Security
```bash
# Test with wrong secret (should fail)
curl -X POST https://sbbundles-main.vercel.app/api/webhooks/dakazina \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: wrong-secret" \
  -d '{"status": "DELIVERED", "reference": "test"}'

# Test with correct secret (should succeed)
curl -X POST https://sbbundles-main.vercel.app/api/webhooks/dakazina \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456" \
  -d '{"status": "DELIVERED", "reference": "test", "test": true}'
```

## ⚠️ If Keys Were Exposed

### Immediate Steps
1. **Rotate Paystack Keys**: Generate new test keys immediately
2. **Update Environment Variables**: Replace keys in both Vercel projects
3. **Check Git History**: Ensure no keys are committed
4. **Review Access**: Check who has access to your repositories
5. **Monitor**: Watch for unusual activity

### Prevention
1. **Never hardcode keys** in source code
2. **Use environment variables** for all secrets
3. **Regular audits** of git history
4. **Team training** on security practices

## 📞 If Security Breach Occurs

1. Immediately rotate all exposed keys
2. Review access logs
3. Check for unauthorized transactions
4. Update all passwords
5. Contact payment providers if needed

---

**Remember**: Environment variables are your friend! Never commit secrets to git.
