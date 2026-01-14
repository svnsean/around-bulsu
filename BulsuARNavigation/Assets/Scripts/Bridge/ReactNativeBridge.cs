// Assets/Scripts/Bridge/ReactNativeBridge.cs
using UnityEngine;

public class ReactNativeBridge : MonoBehaviour
{
    public static ReactNativeBridge Instance { get; private set; }

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Debug.Log("[Bridge] ReactNativeBridge initialized");
        }
        else
        {
            Destroy(gameObject);
        }
    }

    // Called FROM React Native (via Android native code)
    public void ReceiveMessage(string message)
    {
        Debug.Log($"[Bridge] Received from RN: {message}");

        try
        {
            var data = JsonUtility.FromJson<BridgeMessage>(message);

            switch (data.action)
            {
                case "startNavigation":
                    if (ARNavigationController.Instance != null)
                    {
                        ARNavigationController.Instance.StartNavigation(data.payload);
                    }
                    break;

                case "stopNavigation":
                    if (ARNavigationController.Instance != null)
                    {
                        ARNavigationController.Instance.StopNavigation();
                    }
                    break;

                case "updateLocation":
                    // Handle external location updates if needed
                    break;

                default:
                    Debug.LogWarning($"[Bridge] Unknown action: {data.action}");
                    break;
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] Error parsing message: {e.Message}");
        }
    }

    // Send message TO React Native
    public static void SendMessage(string action, string payload)
    {
        var message = new BridgeMessage { action = action, payload = payload };
        string json = JsonUtility.ToJson(message);

        Debug.Log($"[Bridge] Sending to RN: {json}");

#if UNITY_ANDROID && !UNITY_EDITOR
        try
        {
            using (AndroidJavaClass jc = new AndroidJavaClass("com.bulsu.aroundbulsu.UnityBridge"))
            {
                jc.CallStatic("sendToReactNative", json);
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[Bridge] Failed to send to RN: {e.Message}");
        }
#endif
    }
}

[System.Serializable]
public class BridgeMessage
{
    public string action;
    public string payload;
}