import React, {useEffect, useState} from 'react';
import './App.css';
import {Client} from '@stomp/stompjs'
import { useLocation, Navigate } from 'react-router-dom';
import axios from './axiosConfig.js';
import jwtDecode from 'jwt-decode';
const url = 'http://localhost:8080';


function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function PlayPage() {


    const [gameId, setGameId] = useState('');
    const [playerType, setPlayerType] = useState('');
    const [turns, setTurns] = useState([["#", "#", "#"], ["#", "#", "#"], ["#", "#", "#"]]);
    const [gameOn, setGameOn] = useState(false);
    const [login, setLogin] = useState('');
    const [player1, setPlayer1] = useState('');
    const [player1Score, setPlayer1Score] = useState(0);
    const [player2, setPlayer2] = useState('');
    const [player2Score, setPlayer2Score] = useState(0);


    const [currentTurn, setCurrentTurn] = useState('');
    const location = useLocation();
    const email = location.state?.email;
    console.log("email: " + email)

    useEffect(() => {
        
        const token = sessionStorage.getItem('accessToken');
        if (token) {
            setLogin(email);
        }
    }, []);

    const handleLogout = async () => {
        sessionStorage.clear();
        window.location.href = '/login';
      };

    useEffect(() => {
        if (gameId) {
            connectToSocket(gameId);
        }
    }, [gameId]);

    const connectToSocket = (gameId) => {
        const client = new Client();
        const token = sessionStorage.getItem('accessToken');

        client.configure({
            brokerURL: 'ws://localhost:8080/gameplay',
            reconnectDelay: 5000,
            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },
            onConnect: () => {
                console.log('Connected');

                client.subscribe(`/topic/game-progress/${gameId}`, message => {
                    const data = JSON.parse(message.body);
                    console.log(data);
                    setPlayer1(data.player1.login)
                    setPlayer1Score(data.player1.score)
                    setPlayer2(data.player2.login)
                    setPlayer2Score(data.player2.score)
                    displayResponse(data);
                });
            },
            onStompError: (frame) => {
                console.error('Broker reported error: ' + frame.headers['message']);
                console.error('Additional details: ' + frame.body);
            },
            debug: (str) => {
                console.log(new Date(), str);
            }
        });

        client.activate();
    };

    const createGame = async () => {
        if (!login) {
            alert("Please enter login");
            return;
        }
        try {
            const token = sessionStorage.getItem('accessToken');
            const response = await axios.post(url + "/game/start", {login: login},
            {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameId(response.data.gameId);
            setPlayerType('X');
            setCurrentTurn("X")
            reset();
            alert("Your created a game. Game id is: " + response.data.gameId);
            setGameOn(true);
        } catch (error) {
            console.log(error);
        }
    };

    const reset = async () => {
        setTurns([["#", "#", "#"], ["#", "#", "#"], ["#", "#", "#"]]);
    };

    const hardReset = async () => {
        setTurns([["#", "#", "#"], ["#", "#", "#"], ["#", "#", "#"]]);
        const token = sessionStorage.getItem('accessToken');
        await axios.post(url + "/game/reset/" + gameId, {} ,{
            headers: { Authorization: `Bearer ${token}` }
        })
        setGameOn(true);
    }

    const connectToRandom = async () => {
        if (!login) {
            alert("Please enter login");
            return;
        }
        try {
            const token = sessionStorage.getItem('accessToken');
            const response = await axios.post(url + "/game/connect/random", {login}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameId(response.data.gameId);
            setPlayerType('O');
            reset();
            connectToSocket(response.data.gameId);
            alert("Congrats you're playing with: " + response.data.player1.login);
            setGameOn(true);
            displayResponse(response.data)
        } catch (error) {
            console.log(error);
        }
    };

    const makeAMove = async (xCoordinate, yCoordinate) => {
        console.log("playerType" + playerType)
        console.log("currTurn" + currentTurn)

        if (!gameOn || currentTurn !== playerType) return;

        try {
            const token = sessionStorage.getItem('accessToken');
            const response = await axios.post(url + "/game/gameplay", {
                type: playerType,
                coordinateX: xCoordinate,
                coordinateY: yCoordinate,
                gameId,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            displayResponse(response.data, playerType);
        } catch (error) {
            console.log(error);
        }
    };

    const displayResponse = (data) => {
        const newTurns = turns.map((row, i) =>
            row.map((cell, j) => {
                if (data.board[i][j] === 1) return 'X';
                if (data.board[i][j] === 2) return 'O';
                return cell;
            })
        );
        setTurns(newTurns);
        if (data.winner) {
            alert("Winner is " + data.winner);
            setGameOn(false);
        } else {
            setGameOn(true);
            setCurrentTurn(data.currentTurn)
        }
    };
    const handleLoginChange = (event) => {
        // setLogin(event.target.value);
    };

    const handleGameIdChange = (event) => {
        setGameId(event.target.value);
    };

    return (
        <div style={{background: '#212121', color: '#666', fontFamily: 'Arial, sans-serif'}}>
            <h1 style={{color: '#fff'}}>Tic Tac Toe</h1>
            <div id="box" style={{
                background: '#666',
                padding: '20px',
                borderRadius: '10px',
                maxWidth: '350px',
                margin: '40px auto',
                overflow: 'auto'
            }}>
                <input
                    type="text"
                    id="login"
                    placeholder="Enter your login"
                    value={login}
                    onChange={handleLoginChange}
                    style={{width: '95%', marginBottom: '20px', padding: '10px', textAlign: 'center'}}
                />
                <input
                    type="text"
                    id="gameId"
                    placeholder="Enter game ID"
                    value={gameId}
                    onChange={handleGameIdChange}
                    style={{width: '95%', marginBottom: '20px', padding: '10px', textAlign: 'center'}}
                />
                <button onClick={createGame} style={{
                    width: '100%',
                    marginBottom: '10px',
                    padding: '10px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#444',
                    color: '#fff'
                }}>Create Game
                </button>
                <button onClick={connectToRandom} style={{
                    width: '100%',
                    marginBottom: '10px',
                    padding: '10px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#444',
                    color: '#fff'
                }}>Connect to Random Game
                </button>
                {/*<button onClick={connectToSpecificGame} style={{*/}
                {/*    width: '100%',*/}
                {/*    marginBottom: '20px',*/}
                {/*    padding: '10px',*/}
                {/*    borderRadius: '5px',*/}
                {/*    border: 'none',*/}
                {/*    background: '#444',*/}
                {/*    color: '#fff'*/}
                {/*}}>Connect to Specific Game*/}
                {/*</button>*/}
                <div>
                {/* Dodaj przycisk do wylogowania */}
                    <button onClick={handleLogout}>Logout</button>
                {/* Dodaj resztę treści swojej aplikacji */}
                </div>
                <ul id="gameBoard" style={{listStyle: 'none', padding: 0}}>
                    {turns.map((row, i) =>
                        row.map((cell, j) => (
                            <button
                                key={`${i}-${j}`}
                                onClick={() => makeAMove(i, j)}
                                disabled={cell !== '#'}
                                style={{
                                    float: 'left',
                                    margin: '10px',
                                    height: '70px',
                                    width: '70px',
                                    fontSize: '50px',
                                    background: '#333',
                                    color: '#ccc',
                                    textAlign: 'center',
                                    borderRadius: '5px'
                                }}
                                className={cell === 'X' ? 'x' : cell === 'O' ? 'o' : ''}
                            >
                                {cell !== '#' ? cell : ''}
                            </button>
                        ))
                    )}
                </ul>
                <div className="clearfix" style={{clear: 'both'}}></div>
                <button id="reset" onClick={hardReset} disabled={gameOn === true} style={{
                    width: '70%',
                    padding: '15px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#444',
                    color: '#fff',
                    display: 'block',
                    margin: '20px auto'
                }}>Reset
                </button>
            </div>
            <footer style={{textAlign: 'center', paddingTop: '20px'}}>
                <div>
                    {player1 != null && player2 != null && (
                        <div>
                            <div>{player1} score: {player1Score}</div>
                            <div>{player2} score: {player2Score}</div>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    )

}

export default PlayPage;