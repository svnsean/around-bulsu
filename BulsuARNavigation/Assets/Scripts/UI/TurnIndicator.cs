// Assets/Scripts/UI/TurnIndicator.cs
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class TurnIndicator : MonoBehaviour
{
    public static TurnIndicator Instance { get; private set; }

    [Header("UI References")]
    public GameObject turnPanel;
    public Image arrowImage;
    public TextMeshProUGUI turnText;
    public TextMeshProUGUI distanceToTurnText;

    [Header("Arrow Sprites")]
    public Sprite straightArrow;
    public Sprite leftArrow;
    public Sprite rightArrow;
    public Sprite uTurnArrow;
    public Sprite arrivedIcon;

    [Header("Settings")]
    public float showTurnDistance = 30f; // Show turn indicator when within 30m
    public float turnAngleThreshold = 30f; // Degrees to consider a turn

    public enum TurnDirection
    {
        Straight,
        SlightLeft,
        Left,
        SharpLeft,
        SlightRight,
        Right,
        SharpRight,
        UTurn,
        Arrived
    }

    void Awake()
    {
        Instance = this;
    }

    void Start()
    {
        HideTurn();
    }

    public void ShowTurn(TurnDirection direction, float distanceToTurn)
    {
        if (turnPanel != null)
            turnPanel.SetActive(true);

        // Set arrow image
        if (arrowImage != null)
        {
            switch (direction)
            {
                case TurnDirection.Straight:
                    arrowImage.sprite = straightArrow;
                    break;
                case TurnDirection.SlightLeft:
                case TurnDirection.Left:
                case TurnDirection.SharpLeft:
                    arrowImage.sprite = leftArrow;
                    break;
                case TurnDirection.SlightRight:
                case TurnDirection.Right:
                case TurnDirection.SharpRight:
                    arrowImage.sprite = rightArrow;
                    break;
                case TurnDirection.UTurn:
                    arrowImage.sprite = uTurnArrow;
                    break;
                case TurnDirection.Arrived:
                    arrowImage.sprite = arrivedIcon;
                    break;
            }
        }

        // Set turn text
        if (turnText != null)
        {
            turnText.text = GetTurnText(direction);
        }

        // Set distance
        if (distanceToTurnText != null)
        {
            if (direction == TurnDirection.Arrived)
            {
                distanceToTurnText.text = "";
            }
            else
            {
                distanceToTurnText.text = string.Format("in {0:F0}m", distanceToTurn);
            }
        }
    }

    public void HideTurn()
    {
        if (turnPanel != null)
            turnPanel.SetActive(false);
    }

    private string GetTurnText(TurnDirection direction)
    {
        switch (direction)
        {
            case TurnDirection.Straight:
                return "Continue straight";
            case TurnDirection.SlightLeft:
                return "Slight left";
            case TurnDirection.Left:
                return "Turn left";
            case TurnDirection.SharpLeft:
                return "Sharp left";
            case TurnDirection.SlightRight:
                return "Slight right";
            case TurnDirection.Right:
                return "Turn right";
            case TurnDirection.SharpRight:
                return "Sharp right";
            case TurnDirection.UTurn:
                return "Make a U-turn";
            case TurnDirection.Arrived:
                return "You have arrived!";
            default:
                return "";
        }
    }

    // Calculate turn direction based on angle
    public static TurnDirection GetTurnDirection(float angleDegrees)
    {
        // Normalize angle to -180 to 180
        while (angleDegrees > 180) angleDegrees -= 360;
        while (angleDegrees < -180) angleDegrees += 360;

        if (Mathf.Abs(angleDegrees) < 15)
            return TurnDirection.Straight;
        else if (angleDegrees >= 15 && angleDegrees < 45)
            return TurnDirection.SlightRight;
        else if (angleDegrees >= 45 && angleDegrees < 120)
            return TurnDirection.Right;
        else if (angleDegrees >= 120 && angleDegrees < 160)
            return TurnDirection.SharpRight;
        else if (angleDegrees >= 160 || angleDegrees <= -160)
            return TurnDirection.UTurn;
        else if (angleDegrees <= -15 && angleDegrees > -45)
            return TurnDirection.SlightLeft;
        else if (angleDegrees <= -45 && angleDegrees > -120)
            return TurnDirection.Left;
        else if (angleDegrees <= -120 && angleDegrees > -160)
            return TurnDirection.SharpLeft;

        return TurnDirection.Straight;
    }
}