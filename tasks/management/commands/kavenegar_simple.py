# test_kavenegar_simple.py - Simple test script to verify the API works

from kavenegar import KavenegarAPI, APIException, HTTPException


def test_kavenegar_api():
    """Simple test of Kavenegar API"""

    # Your API key
    api_key = '45716874386B306854636F50762B6E4A645039536F703970784239495146586C304C73326E514752776C6F3D'

    # Your senders
    sender_domestic = '2000660110'
    sender_international = '0018018949161'

    try:
        print("🧪 Testing Kavenegar API...")

        # Initialize API (without timeout parameter)
        api = KavenegarAPI(api_key)
        print("✅ KavenegarAPI initialized successfully")

        # Test phone number (your number)
        test_phone = '9809902614909'  # Your number with country code

        # Test message
        test_message = 'تست API کاوه نگار - یان تجارت پویا کویر'

        print(f"📱 Preparing to send SMS to: {test_phone}")
        print(f"📱 Using sender: {sender_domestic}")
        print(f"📱 Message: {test_message}")

        # Prepare SMS parameters
        params = {
            'sender': sender_domestic,
            'receptor': test_phone,
            'message': test_message
        }

        print("🚀 Sending SMS...")

        # Send SMS
        response = api.sms_send(params)

        print("✅ SMS sent successfully!")
        print(f"📱 Response: {response}")

        # Parse response
        if response and len(response) > 0:
            result = response[0]
            print(f"📱 Message ID: {getattr(result, 'messageid', 'N/A')}")
            print(f"📱 Status: {getattr(result, 'status', 'N/A')}")
            print(f"📱 Status Text: {getattr(result, 'statustext', 'N/A')}")
            print(f"📱 Cost: {getattr(result, 'cost', 'N/A')}")

        return True

    except APIException as e:
        print(f"❌ Kavenegar API Error: {e}")
        return False

    except HTTPException as e:
        print(f"❌ HTTP Error: {e}")
        return False

    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("KAVENEGAR API TEST")
    print("=" * 50)

    success = test_kavenegar_api()

    print("=" * 50)
    if success:
        print("🎉 Test completed successfully!")
    else:
        print("💥 Test failed!")
    print("=" * 50)